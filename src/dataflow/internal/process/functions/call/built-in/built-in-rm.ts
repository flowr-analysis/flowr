import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation, KillReference, ControlDependency } from '../../../../../info';
import { markArgumentsAsNonStandardEvaluation, processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { RNumber } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { isValue } from '../../../../../eval/values/r-value';
import { applyKills } from '../../../../../environments/apply-kill';
import { define } from '../../../../../environments/define';
import type { EnvirResolution } from './built-in-envir-utils';
import { resolveArgToEnvir } from './built-in-envir-utils';
import { resolveNodeToStackEnv } from './built-in-stack-env';
import { Resolve } from '../../../../../environments/resolve-helper';

/** The variables an `rm` call targets for removal, and the frame it removes them from. */
interface RmTargets<OtherInfo> {
	/** statically known names to remove */
	readonly names: { name: Identifier, nodeId: NodeId }[];
	/** the whole scope is cleared, e.g., `rm(list = ls())` */
	all:            boolean;
	/** at least one target could not be resolved to a concrete name */
	unknown:        boolean;
	/** the `envir=`/`pos=` argument redirecting the removal, unless it denotes the current frame */
	frame?:         RmFrameArg<OtherInfo>;
}

/** An `rm` argument that redirects the removal to another frame. */
interface RmFrameArg<OtherInfo> {
	readonly formal: 'pos' | 'envir';
	readonly arg:    RArgument<OtherInfo & ParentInformation>;
}

/** whether `value` is a call to the *built-in* `ls`/`objects` that lists (and thus clears) the whole scope */
function isBuiltInLsCall<OtherInfo>(value: RNode<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	if(value.type !== RType.FunctionCall || !value.named) {
		return false;
	}
	const [fn, ns] = Identifier.toArray(value.functionName.content);
	if((fn !== 'ls' && fn !== 'objects') || (ns !== undefined && ns !== 'base')) {
		return false;
	}
	// a `pattern`/`envir` argument restricts the listing, so only a plain listing clears everything
	const listsEverything = value.arguments.every(a => a !== EmptyArgument && a.name !== undefined && (a.name.content === 'all.names' || a.name.content === 'sorted'));
	if(!listsEverything) {
		return false;
	}
	// an explicit `base::` is always the built-in; otherwise only when `ls` is not shadowed
	return ns === 'base' || Resolve.isBuiltIn(fn, data.environment, ReferenceType.Function);
}

/** How a formal of `rm` contributes to the removal. */
type RmFormalRole = 'names' | 'frame' | 'modifier';

/**
 * The formals of `rm(..., list = character(), pos = -1, envir = as.environment(pos), inherits = FALSE)`.
 * All of them follow `...`, so R matches them by their exact name only and every other argument lands in
 * `...`, naming a variable to remove (in R 4.6, `rm(envi = "y")` removes `y` rather than picking an `envir`).
 */
const RmFormals: Readonly<Record<string, RmFormalRole>> = {
	list:     'names',
	pos:      'frame',
	envir:    'frame',
	inherits: 'modifier'
};

/**
 * Whether a `pos`/`envir` value still names the frame the call happens in, so the removal stays local.
 * Mirrors R's defaults: `pos = -1`, and `envir = as.environment(pos)` for everything
 * {@link resolveNodeToStackEnv} can read (`environment()`, `globalenv()`, `.GlobalEnv`, ...).
 */
function targetsCurrentFrame<OtherInfo>(
	formal: RmFrameArg<OtherInfo>['formal'],
	value:  RNode<OtherInfo & ParentInformation>,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>
): boolean {
	if(formal === 'pos') {
		return RNumber.literalValueOf(value) === -1;
	}
	return resolveNodeToStackEnv(value, data)?.current === data.environment.current;
}

/** The role R's argument matching gives `arg`; anything but an exactly named formal belongs to `...`. */
function roleOf<OtherInfo>(arg: Exclude<PotentiallyEmptyRArgument<OtherInfo & ParentInformation>, typeof EmptyArgument>): RmFormalRole | 'dots' {
	return (arg.name === undefined ? undefined : RmFormals[arg.name.content]) ?? 'dots';
}

/** Adds the name a single `...` argument (an unquoted symbol or quoted string) refers to. */
function collectDotArg<OtherInfo>(targets: RmTargets<OtherInfo>, value: RNode<OtherInfo & ParentInformation> | undefined): void {
	if(value?.type === RType.Symbol) {
		targets.names.push({ name: value.content, nodeId: value.info.id });
	} else if(value?.type === RType.String) {
		targets.names.push({ name: value.content.str, nodeId: value.info.id });
	} else if(value !== undefined) {
		dataflowLogger.warn(`argument is not a symbol or string in rm, skipping ${JSON.stringify(value)}`);
		targets.unknown = true;
	}
}

/** Resolves the `list=` argument, recognizing a whole-scope clear via built-in `ls()` and concrete string vectors. */
function collectListArg<OtherInfo>(targets: RmTargets<OtherInfo>, value: RNode<OtherInfo & ParentInformation> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): void {
	if(!value) {
		return;
	}
	if(value.type === RType.String) {
		targets.names.push({ name: value.content.str, nodeId: value.info.id });
	} else if(isBuiltInLsCall(value, data)) {
		targets.all = true;
	} else {
		const elements = NodeValue.setOf(value.info.id, data)?.elements;
		if(!elements || elements.length === 0) {
			targets.unknown = true;
		} else {
			for(const r of elements) {
				if(r.type === 'string' && isValue(r.value)) {
					targets.names.push({ name: r.value.str, nodeId: value.info.id });
				} else {
					targets.unknown = true;
				}
			}
		}
	}
}

/**
 * Collects the removal targets of an `rm` call, following R's argument matching: everything but an exactly
 * named formal is swallowed by `...` and names a variable, `list=` is resolved separately, `inherits=` adds
 * nothing, and `pos=`/`envir=` are kept as the frame the removal is redirected to (`envir` wins, as R derives
 * its default from `pos`).
 */
function collectRmTargets<OtherInfo>(
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): RmTargets<OtherInfo> {
	const targets: RmTargets<OtherInfo> = { names: [], all: false, unknown: false };
	for(const arg of args) {
		if(arg === EmptyArgument) {
			continue;
		}
		switch(roleOf(arg)) {
			case 'dots':
				collectDotArg(targets, arg.value);
				break;
			case 'names':
				collectListArg(targets, arg.value, data);
				break;
			case 'frame': {
				const formal = arg.name?.content as RmFrameArg<OtherInfo>['formal'];
				if(arg.value !== undefined && targetsCurrentFrame(formal, arg.value, data)) {
					break;
				}
				if(formal === 'envir' || targets.frame === undefined) {
					targets.frame = { formal, arg };
				}
				break;
			}
			case 'modifier':
				break;
		}
	}
	return targets;
}

/** Builds the {@link KillReference|kills} produced by an `rm` call from its resolved {@link RmTargets}. */
function buildKills<OtherInfo>(targets: RmTargets<OtherInfo>, cds: ControlDependency[] | undefined): KillReference[] {
	const kills: KillReference[] = [];
	if(targets.all) {
		kills.push({ kind: 'all', cds });
	}
	if(targets.unknown) {
		kills.push({ kind: 'unknown', cds });
	}
	for(const { name, nodeId } of targets.names) {
		kills.push({ kind: 'named', reference: { nodeId, name, cds, type: ReferenceType.Variable } });
	}
	return kills;
}

/** Removes the targets from a tracked custom environment (`rm(..., envir=e)`) instead of the lexical scope. */
function removeFromCustomEnv<OtherInfo>(res: DataflowInformation, envir: EnvirResolution<OtherInfo>, targets: RmTargets<OtherInfo>, rootId: NodeId, cds: ControlDependency[] | undefined): DataflowInformation {
	const newEnvState = applyKills(envir.envDef.envState, buildKills(targets, cds));
	const environment = define({ ...envir.envDef, definedAt: rootId, envState: newEnvState }, false, res.environment);
	return { ...res, environment };
}

/** The arguments `rm` swallows with its `...`: they name what to remove instead of being evaluated. */
function nonStandardArguments<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[]): Set<number> {
	const indices = new Set<number>();
	for(const [i, arg] of args.entries()) {
		if(arg !== EmptyArgument && roleOf(arg) === 'dots') {
			indices.add(i);
		}
	}
	return indices;
}

/**
 * Process an `rm` call, marking the removed variables as {@link KillReference|killed} so the removal is
 * carried to the enclosing scope even when it happens nested within a branch or block.
 * As in R, the names to remove are not evaluated, so `rm(x)` does not read `x`.
 */
export function processRm<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	if(args.length === 0) {
		dataflowLogger.warn('empty rm, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const nse = nonStandardArguments(args);
	const { information, processedArguments, fnRef } = processKnownFunctionCall({
		name, args, rootId, data,
		origin:    BuiltInProcName.Rm,
		/* an unevaluated name must not resolve against the environment */
		patchData: (d, i) => nse.has(i) ? { ...d, environment: d.ctx.env.makeCleanEnv() } : d
	});
	markArgumentsAsNonStandardEvaluation(information.graph, rootId, processedArguments, [...nse]);

	/* the enclosing scope would link the unevaluated names, so they must not escape this call */
	const evaluated = processedArguments.filter((p, i) => p !== undefined && !nse.has(i)) as DataflowInformation[];
	const res: DataflowInformation = {
		...information,
		in:                [fnRef, ...evaluated.flatMap(p => p.in)],
		out:               evaluated.flatMap(p => p.out),
		unknownReferences: evaluated.flatMap(p => p.unknownReferences)
	};

	const targets = collectRmTargets(args, data);

	if(targets.frame !== undefined) {
		// `rm(x, envir=e)` removes from a tracked custom environment instead of the lexical scope
		if(targets.frame.formal === 'envir' && data.ctx.config.solver.trackEnvironments) {
			const envir = resolveArgToEnvir(targets.frame.arg, data);
			if(envir) {
				return removeFromCustomEnv(res, envir, targets, rootId, data.cds);
			}
		}
		// any other frame we cannot identify, so the one we are analyzing stays untouched
		return res;
	}

	// apply to our own environment so threading reflects it, and emit the kills so a merging parent can re-apply
	const kills = buildKills(targets, data.cds);
	return kills.length > 0 ? { ...res, environment: applyKills(res.environment, kills), kill: kills } : res;
}
