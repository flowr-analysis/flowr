import { MatchArgs } from '../../../../../graph/match-args';
import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import type { ControlDependency, DataflowInformation, KillReference } from '../../../../../info';
import { alwaysExits } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { convertFnArguments, patchFunctionCall } from '../common';
import { unpackArg } from '../argument/unpack-argument';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { EdgeType } from '../../../../../graph/edge';
import { ControlFlow } from '../../../../control-flow';
import { appendEnvironment } from '../../../../../environments/append';
import { Identifier, type IdentifierReference, ReferenceType } from '../../../../../environments/identifier';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';
import { applyKills, makeKillsMaybe } from '../../../../../environments/apply-kill';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';

/** `if(<cond>) <then> else <else>` built-in function configuration, make sure to not reuse indices */
export interface IfThenElseConfig {
	args?: {
		/** the expression to treat as condition, defaults to index 0 */
		cond: string,
		/** argument to treat as yes/'then' case, defaults to index 1 */
		yes:  string,
		/** argument to treat as no/'else' case, defaults to index 2 */
		no:   string
	}
}

function getArguments<OtherInfo>(config: IfThenElseConfig | undefined, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[]) {
	let condArg: RNode<OtherInfo & ParentInformation> | undefined;
	let thenArg: RNode<OtherInfo & ParentInformation> | undefined;
	let otherwiseArg: RNode<OtherInfo & ParentInformation> | undefined;

	if(config?.args) {
		const params = {
			[config.args.cond]: 'cond',
			[config.args.yes]:  'yes',
			[config.args.no]:   'no',
			'...':              '...'
		};
		const argMaps = MatchArgs.toSpec(convertFnArguments(args), params);
		condArg = unpackArg(RArgument.getWithId(args, argMaps.get('cond')?.[0]));
		thenArg = unpackArg(RArgument.getWithId(args, argMaps.get('yes')?.[0]));
		otherwiseArg = unpackArg(RArgument.getWithId(args, argMaps.get('no')?.[0]));
	} else {
		[condArg, thenArg, otherwiseArg] = args.map(e => unpackArg(e));
	}
	return { condArg, thenArg, otherwiseArg };
}

/**
 * Processes an if-then-else built-in function call.
 * For example, `if(cond) thenExpr else elseExpr` and `if(cond) thenExpr`.
 * The arguments will be either `[cond, thenExpr]` or `[cond, thenExpr, elseExpr]`.
 */
export function processIfThenElse<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config?: IfThenElseConfig
): DataflowInformation {
	if(args.length !== 2 && args.length !== 3) {
		dataflowLogger.warn(`If-then-else ${Identifier.toString(name.content)} has something different from 2 or 3 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const { condArg, thenArg, otherwiseArg } = getArguments(config, args);

	if(condArg === undefined || thenArg === undefined) {
		dataflowLogger.warn(`If-then-else ${Identifier.toString(name.content)} has empty condition or then case in ${JSON.stringify(args)}, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const cond = processDataflowFor(condArg, data);

	if(alwaysExits(cond)) {
		dataflowLogger.warn(`If-then-else ${rootId} forces exit in condition, skipping rest`);
		return cond;
	}

	const originalDependency = data.cds?.slice();
	// currently we update the cd afterward :sweat:
	data = { ...data, environment: cond.environment };

	let then: DataflowInformation | undefined;
	let makeThenMaybe = false;

	// we should defer this to the abstract interpretation
	const values = NodeValue.setOf(condArg?.info.id, data);
	/*
	 * `ifelse` and its relatives are ordinary functions, so R evaluates every argument whatever the condition
	 * says; only the `if` keyword leaves a branch unevaluated and may therefore be resolved away here.
	 */
	const branchesAreLazy = config?.args === undefined;
	const conditionIsAlwaysFalse = branchesAreLazy && (values?.elements.every(d => d.type === 'logical' && d.value === false) ?? false);
	const conditionIsAlwaysTrue = branchesAreLazy && (values?.elements.every(d => d.type === 'logical' && d.value === true) ?? false);

	if(!conditionIsAlwaysFalse) {
		then = processDataflowFor(thenArg, data);
		if(then.entryPoint) {
			then.graph.addEdge(rootId, then.entryPoint, EdgeType.Returns);
		}
		if(!conditionIsAlwaysTrue) {
			makeThenMaybe = true;
		}
	}

	let otherwise: DataflowInformation | undefined;
	let makeOtherwiseMaybe = false;
	if(otherwiseArg !== undefined && !conditionIsAlwaysTrue) {
		data = { ...data, cds: originalDependency?.slice() };
		otherwise = processDataflowFor(otherwiseArg, data);
		if(otherwise.entryPoint) {
			otherwise.graph.addEdge(rootId, otherwise.entryPoint, EdgeType.Returns);
		}
		if(!conditionIsAlwaysFalse) {
			makeOtherwiseMaybe = true;
		}
	}

	const nextGraph = cond.graph.mergeWith(then?.graph).mergeWith(otherwise?.graph);
	const thenEnvironment = then?.environment ?? cond.environment;

	// if there is no "else" case, we have to recover whatever we had before as it may be not executed
	let finalEnvironment: REnvironmentInformation;

	if(conditionIsAlwaysFalse) {
		finalEnvironment = otherwise ? otherwise.environment : cond.environment;
	} else if(conditionIsAlwaysTrue) {
		finalEnvironment = thenEnvironment;
	} else {
		finalEnvironment = appendEnvironment(thenEnvironment, otherwise ? otherwise.environment : cond.environment);
	}

	const whenTrue: ControlDependency = { id: rootId, when: true };
	const whenFalse: ControlDependency = { id: rootId, when: false };
	const cdTrue = [whenTrue];
	const cdFalse = [whenFalse];
	// again within an if-then-else we consider all actives to be read
	const ingoing: IdentifierReference[] = cond.in.concat(
		makeThenMaybe ? makeAllMaybe(then?.in, nextGraph, finalEnvironment, false, cdTrue) : then?.in ?? [],
		makeOtherwiseMaybe ? makeAllMaybe(otherwise?.in, nextGraph, finalEnvironment, false, cdFalse) : otherwise?.in ?? [],
		cond.unknownReferences,
		makeThenMaybe ? makeAllMaybe(then?.unknownReferences, nextGraph, finalEnvironment, false, cdTrue) : then?.unknownReferences ?? [],
		makeOtherwiseMaybe ? makeAllMaybe(otherwise?.unknownReferences, nextGraph, finalEnvironment, false, cdFalse) : otherwise?.unknownReferences ?? [],
	);

	// we assign all with a maybe marker
	// we do not merge even if they appear in both branches because the maybe links will refer to different ids
	const outgoing =
		cond.out.concat(
			(makeThenMaybe ? makeAllMaybe(then?.out, nextGraph, finalEnvironment, true, cdTrue) : then?.out ?? []),
			(makeOtherwiseMaybe ? makeAllMaybe(otherwise?.out, nextGraph, finalEnvironment, true, cdFalse) : otherwise?.out ?? []),
		);

	// a branch-local removal only happens maybe; apply it here since the branch-environment merge cannot represent it
	let killed: KillReference[] | undefined;
	if(then?.kill?.length || otherwise?.kill?.length) {
		killed = (makeThenMaybe ? makeKillsMaybe(then?.kill, cdTrue) : then?.kill ?? [])
			.concat(makeOtherwiseMaybe ? makeKillsMaybe(otherwise?.kill, cdFalse) : otherwise?.kill ?? []);
		finalEnvironment = applyKills(finalEnvironment, killed);
	}

	patchFunctionCall({
		nextGraph,
		rootId,
		name,
		data:                  { ...data, cds: originalDependency },
		argumentProcessResult: [cond, then, otherwise],
		origin:                BuiltInProcName.IfThenElse
	});

	// as an if always evaluates its condition, we add a 'reads'-edge
	nextGraph.addEdge(rootId, cond.entryPoint, EdgeType.Reads);

	const exitPoints = (then?.exitPoints ?? []).map(e => ({ ...e, cds: makeThenMaybe ? [...data.cds ?? [], { id: rootId, when: true }] : e.cds }))
		.concat((otherwise?.exitPoints ?? []).map(e => ({ ...e, cds: makeOtherwiseMaybe ? [...data.cds ?? [], { id: rootId, when: false }] : e.cds })));

	const reachesJoin = then === undefined || otherwise === undefined
		|| ControlFlow.canComplete(then) || ControlFlow.canComplete(otherwise);
	if(conditionIsAlwaysTrue) {
		/* the condition is known, so there is no decision left to make and only one way to go */
		ControlFlow.continuesWith(nextGraph, cond, then ? ControlFlow.entryOf(then) : rootId);
	} else if(conditionIsAlwaysFalse) {
		ControlFlow.continuesWith(nextGraph, cond, otherwise ? ControlFlow.entryOf(otherwise) : rootId);
	} else {
		ControlFlow.branchesTo(nextGraph, cond, then ? ControlFlow.entryOf(then) : rootId, whenTrue);
		ControlFlow.branchesTo(nextGraph, cond, otherwise ? ControlFlow.entryOf(otherwise) : rootId, whenFalse);
	}
	if(then !== undefined) {
		ControlFlow.continuesWith(nextGraph, then, rootId);
	}
	if(otherwise !== undefined) {
		ControlFlow.continuesWith(nextGraph, otherwise, rootId);
	}

	return {
		unknownReferences: [],
		in:                [{ nodeId: rootId, name: name.content, cds: originalDependency, type: ReferenceType.Function }, ...ingoing],
		out:               outgoing,
		exitPoints,
		entryPoint:        rootId,
		cfgEntry:          ControlFlow.entryOf(cond),
		cfgExit:           reachesJoin ? rootId : undefined,
		environment:       finalEnvironment,
		graph:             nextGraph,
		hooks:             cond.hooks.concat(then?.hooks ?? [], otherwise?.hooks ?? []),
		kill:              killed,
	};
}
