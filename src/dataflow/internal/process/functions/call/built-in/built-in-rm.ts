import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation, KillReference, ControlDependency } from '../../../../../info';
import { markArgumentsAsNonStandardEvaluation, processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { Identifier, isReferenceType, ReferenceType } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { findByPrefixIfUnique } from '../../../../../../util/prefix';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { isValue } from '../../../../../eval/values/r-value';
import { applyKills } from '../../../../../environments/apply-kill';
import { define } from '../../../../../environments/define';
import type { EnvirResolution } from './built-in-envir-utils';
import { resolveEnvirArg } from './built-in-envir-utils';
import { Resolve } from '../../../../../environments/resolve-helper';

/** The variables an `rm` call targets for removal. */
interface RmTargets {
	/** statically known names to remove */
	readonly names: { name: Identifier, nodeId: NodeId }[];
	/** the whole scope is cleared, e.g., `rm(list = ls())` */
	all:            boolean;
	/** at least one target could not be resolved to a concrete name */
	unknown:        boolean;
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
	if(ns === 'base') {
		return true;
	}
	const resolved = Resolve.byNameAndType(fn, data.environment, ReferenceType.Function);
	return resolved === undefined || resolved.every(d => isReferenceType(d.type, ReferenceType.BuiltInFunction));
}

/** formal parameters of `rm` that may be given by name; every other positional argument belongs to `...` */
const RmNamedFormals = ['list', 'pos', 'envir', 'inherits'];

/** Adds the name a single `...` argument (an unquoted symbol or quoted string) refers to. */
function collectDotArg<OtherInfo>(targets: RmTargets, value: RNode<OtherInfo & ParentInformation> | undefined): void {
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
function collectListArg<OtherInfo>(targets: RmTargets, value: RNode<OtherInfo & ParentInformation> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): void {
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
 * Collects the removal targets of an `rm` call: every unnamed argument names a variable (`rm`'s `...` swallows
 * all positionals), `list=` is resolved separately, and `pos`/`envir`/`inherits` contribute no names.
 */
function collectRmTargets<OtherInfo>(
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): RmTargets {
	const targets: RmTargets = { names: [], all: false, unknown: false };
	for(const arg of args) {
		if(arg === EmptyArgument) {
			continue;
		}
		if(arg.name === undefined) {
			collectDotArg(targets, arg.value);
			continue;
		}
		const formal = findByPrefixIfUnique(arg.name.content, RmNamedFormals);
		if(formal === 'list') {
			collectListArg(targets, arg.value, data);
		} else if(formal === undefined) {
			// an unknown named argument falls into `...` in R, but we cannot tell which name it removes
			targets.unknown = true;
		}
	}
	return targets;
}

/** Builds the {@link KillReference|kills} produced by an `rm` call from its resolved {@link RmTargets}. */
function buildKills(targets: RmTargets, cds: ControlDependency[] | undefined): KillReference[] {
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
function removeFromCustomEnv<OtherInfo>(res: DataflowInformation, envir: EnvirResolution<OtherInfo>, targets: RmTargets, rootId: NodeId, cds: ControlDependency[] | undefined): DataflowInformation {
	const newEnvState = applyKills(envir.envDef.envState, buildKills(targets, cds));
	const environment = define({ ...envir.envDef, definedAt: rootId, envState: newEnvState }, false, res.environment);
	return { ...res, environment };
}

/** The arguments `rm` swallows with its `...`: they name what to remove instead of being evaluated. */
function nonStandardArguments<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[]): Set<number> {
	const indices = new Set<number>();
	for(const [i, arg] of args.entries()) {
		if(arg !== EmptyArgument && (arg.name === undefined || findByPrefixIfUnique(arg.name.content, RmNamedFormals) === undefined)) {
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

	// `rm(x, envir=e)` removes from a tracked custom environment instead of the lexical scope
	if(data.ctx.config.solver.trackEnvironments) {
		const envir = resolveEnvirArg(args, data, 'envir');
		if(envir) {
			return removeFromCustomEnv(res, envir, targets, rootId, data.cds);
		}
	}

	// apply to our own environment so threading reflects it, and emit the kills so a merging parent can re-apply
	const kills = buildKills(targets, data.cds);
	return kills.length > 0 ? { ...res, environment: applyKills(res.environment, kills), kill: kills } : res;
}
