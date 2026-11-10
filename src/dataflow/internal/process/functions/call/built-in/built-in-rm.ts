import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { findByPrefixIfUnique } from '../../../../../../util/prefix';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation, KillReference, ControlDependency } from '../../../../../info';
import { markArgumentsAsNonStandardEvaluation, processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type PotentiallyEmptyRArgument, EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RNumber } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { Identifier, ReferenceType, type BrandedIdentifier } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { isValue } from '../../../../../eval/values/r-value';
import { applyGlobalKills, applyKills } from '../../../../../environments/apply-kill';
import { EdgeType } from '../../../../../graph/edge';
import type { EnvirResolution } from './built-in-envir-utils';
import { rebindHolders, resolveEnvirOrPosition } from './built-in-envir-utils';
import { resolveNodeToStackEnv } from './built-in-stack-env';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { ambientWritesOfRelease } from './built-in-ambient-state';
import { REnvironment } from '../../../../../environments/environment';

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

/** the formals of `ls`, which R matches by unique prefix (`all = TRUE` is `all.names = TRUE`) */
const LsFormals: readonly BrandedIdentifier[] = ['name', 'pos', 'envir', 'all.names', 'pattern', 'sorted'];

/** whether `value` is a call to the *built-in* `ls`/`objects` that lists (and thus clears) the whole scope, or the whole of `target`, the environment `rm` removes from (`rm(list = ls(e), envir = e)`) */
function isBuiltInLsCall<OtherInfo>(value: RNode<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, target?: RNode<OtherInfo & ParentInformation>): boolean {
	if(!RFunctionCall.isNamed(value)) {
		return false;
	}
	const [fn, ns] = Identifier.toArray(value.functionName.content);
	if((fn !== 'ls' && fn !== 'objects') || (ns !== undefined && ns !== 'base')) {
		return false;
	}
	// a `pattern` argument restricts the listing, and so does an environment that is not the one removed from, only a plain listing clears everything
	const listsEverything = value.arguments.every((a, i) => {
		if(RArgument.isEmpty(a)) {
			return false;
		}
		const formal = a.name === undefined ? undefined : findByPrefixIfUnique(Identifier.getName(a.name.content), LsFormals);
		if(formal === 'all.names' || formal === 'sorted') {
			return true;
		}
		/* the first unnamed argument is `name`, an environment is taken as is */
		return (formal === 'envir' || formal === 'name' || (a.name === undefined && i === 0)) && isSameEnvironment(a.value, target, data);
	});
	if(!listsEverything) {
		return false;
	}
	// an explicit `base::` is always the built-in; otherwise only when `ls` is not shadowed
	return ns === 'base' || Resolve.isBuiltIn(fn, data.environment, ReferenceType.Function);
}

/** whether both nodes are the same variable, bound by the same definitions */
function isSameEnvironment<OtherInfo>(a: RNode<OtherInfo & ParentInformation> | undefined, b: RNode<OtherInfo & ParentInformation> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	if(!RSymbol.is(a) || !RSymbol.is(b) || a.content !== b.content) {
		return false;
	}
	const [da, db] = [Resolve.byName(a.content, data.environment), Resolve.byName(b.content, data.environment)];
	return da !== undefined && da.length > 0 && da.length === db?.length && da.every(d => db.some(o => o.nodeId === d.nodeId));
}

/** How a formal of `rm` contributes to the removal. */
type RmFormalRole = 'names' | 'frame' | 'modifier';

/** The formals of `rm(..., list = character(), pos = -1, envir = as.environment(pos), inherits = FALSE)`. */
const RmFormals: Readonly<Record<BrandedIdentifier, RmFormalRole>> = {
	list:     'names',
	pos:      'frame',
	envir:    'frame',
	inherits: 'modifier'
};

/** Whether a `pos`/`envir` value still names the frame the call happens in, so the removal stays local. */
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
function roleOf<OtherInfo>(arg: RArgument<OtherInfo & ParentInformation>): RmFormalRole | 'dots' {
	return (arg.name === undefined ? undefined : RmFormals[arg.name.content]) ?? 'dots';
}

/** Adds the name a single `...` argument (an unquoted symbol or quoted string) refers to. */
function collectDotArg<OtherInfo>(targets: RmTargets<OtherInfo>, value: RNode<OtherInfo & ParentInformation> | undefined): void {
	if(RSymbol.is(value)) {
		targets.names.push({ name: value.content, nodeId: value.info.id });
	} else if(RString.is(value)) {
		targets.names.push({ name: value.content.str, nodeId: value.info.id });
	} else if(value !== undefined) {
		dataflowLogger.warn(`argument is not a symbol or string in rm, skipping ${JSON.stringify(value)}`);
		targets.unknown = true;
	}
}

/** Resolves the `list=` argument, recognizing a whole-scope clear via built-in `ls()` and concrete string vectors. */
function collectListArg<OtherInfo>(targets: RmTargets<OtherInfo>, value: RNode<OtherInfo & ParentInformation> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, envir: RNode<OtherInfo & ParentInformation> | undefined): void {
	if(!value) {
		return;
	}
	if(RString.is(value)) {
		targets.names.push({ name: value.content.str, nodeId: value.info.id });
	} else if(isBuiltInLsCall(value, data, envir)) {
		targets.all = true;
	} else {
		const elements = NodeValue.setOf(value.info.id, data)?.elements;
		if(!elements || elements.length === 0) {
			targets.unknown = true;
		} else {
			// `list = c("a", "b")` (or a variable holding it) is a vector: it removes every one of its strings
			for(const r of elements.flatMap(e => e.type === 'vector' && isValue(e.elements) ? e.elements : [e])) {
				if(r.type === 'string' && isValue(r.value)) {
					targets.names.push({ name: r.value.str, nodeId: value.info.id });
				} else {
					targets.unknown = true;
				}
			}
		}
	}
}

/** Collects the removal targets of an `rm` call, following R's argument matching: everything but an exactly named formal is swallowed by `...` and names a variable, `list=` is resolved separately, `inherits=` adds nothing, and `pos=`/`envir=` are kept as the frame the removal is redirected to (`envir` wins, as R derives its default from `pos`). */
function collectRmTargets<OtherInfo>(
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): RmTargets<OtherInfo> {
	const targets: RmTargets<OtherInfo> = { names: [], all: false, unknown: false };
	const envirArg = RArgument.findNamed(args, 'envir')?.value;
	for(const arg of args) {
		if(RArgument.isEmpty(arg)) {
			continue;
		}
		switch(roleOf(arg)) {
			case 'dots':
				collectDotArg(targets, arg.value);
				break;
			case 'names':
				collectListArg(targets, arg.value, data, envirArg);
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
function buildKills<OtherInfo>(targets: RmTargets<OtherInfo>, cds: readonly ControlDependency[] | undefined, killedBy: NodeId): KillReference[] {
	const kills: KillReference[] = [];
	if(targets.all) {
		kills.push({ kind: 'all', cds, killedBy });
	}
	if(targets.unknown) {
		kills.push({ kind: 'unknown', cds });
	}
	for(const { name, nodeId } of targets.names) {
		kills.push({ kind: 'named', reference: { nodeId, name, cds, type: ReferenceType.Variable }, killedBy });
	}
	return kills;
}

/** Removes the targets from a tracked custom environment (`rm(..., envir=e)`) instead of the lexical scope. */
function removeFromCustomEnv<OtherInfo>(res: DataflowInformation, envir: EnvirResolution<OtherInfo>, targets: RmTargets<OtherInfo>, rootId: NodeId, cds: readonly ControlDependency[] | undefined): DataflowInformation {
	const closureFrame = envir.envDef.closureFrame === true;
	/* whether `rm` removes a binding or warns that there is none depends on the definitions it removes, see `processRm` */
	for(const { name } of targets.names) {
		for(const definition of envir.envirData.environment.current.memory.get(Identifier.getName(name)) ?? []) {
			if(!NodeId.isBuiltIn(definition.definedAt)) {
				res.graph.addEdge(rootId, definition.definedAt, EdgeType.Reads);
			}
		}
	}
	const newEnvState = applyKills(envir.envDef.envState, buildKills(targets, cds, rootId), closureFrame);
	if(closureFrame) {
		res.graph.addEdge(rootId, envir.envirNodeId, EdgeType.Reads);
		return { ...res, environment: rebindHolders(res.environment, envir.envDef, newEnvState, rootId) };
	}
	const environment = REnvironment.define({ ...envir.envDef, definedAt: rootId, envState: newEnvState }, false, res.environment);
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

/** Process an `rm` call, marking the removed variables as {@link KillReference|killed} so the removal is carried to the enclosing scope even when it happens nested within a branch or block. */
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
		keepArgumentGraphs: true,
		name, args, rootId, data,
		origin:             BuiltInProcName.Rm,
		/* an unevaluated name must not resolve against the environment */
		patchData:          (d, i) => nse.has(i) ? { ...d, environment: REnvironment.cleanOf(d.environment) } : d
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
		const envir = resolveEnvirOrPosition(targets.frame.arg, targets.frame.formal, data);
		/* a function removing from the global frame removes for its callers, as `<<-` defines for them */
		if(envir?.stack === 'global') {
			res.graph.addEdge(rootId, envir.envirNodeId, EdgeType.Reads);
			/* whether `rm` removes a binding or warns that there is none depends on the definitions it removes, see below */
			const global = envir.envirData.environment.current;
			for(const { name } of targets.names) {
				for(const definition of global.lookup(Identifier.getName(name)) ?? global.superMemory?.get(Identifier.getName(name)) ?? []) {
					if(!NodeId.isBuiltIn(definition.nodeId)) {
						res.graph.addEdge(rootId, definition.nodeId, EdgeType.Reads);
					}
				}
			}
			return { ...res, environment: applyGlobalKills(res.environment, buildKills(targets, data.cds, rootId)) };
		}
		// `rm(x, envir=e)` removes from a tracked custom environment instead of the lexical scope
		if(envir !== undefined && envir.stack === undefined && targets.frame.formal === 'envir' && data.ctx.config.solver.trackEnvironments) {
			return removeFromCustomEnv(res, envir, targets, rootId, data.cds);
		}
		/* any other frame, that of a function around or one we cannot identify, leaves the one we are analyzing untouched, but what it removes there is out of reach */
		handleUnknownSideEffect(res.graph, res.environment, rootId);
		return res;
	}

	/* whether `rm` removes a binding or warns that there is none depends on the definitions it removes */
	for(const { name } of targets.names) {
		for(const definition of Resolve.byName(name, data.environment) ?? []) {
			if(!NodeId.isBuiltIn(definition.nodeId)) {
				res.graph.addEdge(rootId, definition.nodeId, EdgeType.Reads);
			}
		}
	}
	// apply to our own environment so threading reflects it, and emit the kills so a merging parent can re-apply
	const kills = buildKills(targets, data.cds, rootId);
	if(kills.length === 0) {
		return res;
	}
	const names = targets.all || targets.unknown ? undefined : targets.names.map(n => n.name);
	return { ...res, environment: ambientWritesOfRelease(res.graph, applyKills(res.environment, kills), names, rootId, data.cds), kill: kills };
}
