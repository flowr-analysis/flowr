import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import type { ControlDependency, DataflowInformation, KillReference } from '../../../../../info';
import { onlyLiterals } from '../../../../../eval/resolve/resolve';
import { processKnownFunctionCall } from '../known-call-handling';
import { convertFnArguments, patchFunctionCall } from '../common';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { EdgeType } from '../../../../../graph/edge';
import { ControlFlow } from '../../../../control-flow';
import { makeAmbientWritesMaybe } from './built-in-ambient-state';
import { appendEnvironment } from '../../../../../environments/append';
import { Identifier, type IdentifierReference, ReferenceType } from '../../../../../environments/identifier';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';
import { applyKills, makeKillsMaybe } from '../../../../../environments/apply-kill';
import { RNode, RLoopConstructs } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
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

function conditionalArgsOf<OtherInfo>(
	config: IfThenElseConfig | undefined,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[]
): (RNode<OtherInfo & ParentInformation> | undefined)[] {
	if(!config?.args) {
		return args.map(e => RArgument.valueOf(e));
	}
	const params = {
		[config.args.cond]: 'cond',
		[config.args.yes]:  'yes',
		[config.args.no]:   'no',
		'...':              '...'
	};
	const argMaps = FunctionSemantics.call.match.toSpec(convertFnArguments(args), params);
	return (['cond', 'yes', 'no'] as const).map(k => RArgument.valueOf(RArgument.getWithId(args, argMaps.get(k)?.[0])));
}

/** Whether `id` may run again in the same frame, as part of a loop not left through a function definition. */
function withinLoop(id: NodeId, idMap: AstIdMap<ParentInformation>): boolean {
	const enclosing = RNode.findEnclosing(id, idMap, n => RFunctionDefinition.is(n) || RLoopConstructs.is(n));
	return enclosing !== undefined && !RFunctionDefinition.is(idMap.get(enclosing));
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

	const [condArg, thenArg, otherwiseArg] = conditionalArgsOf(config, args);
	if(condArg === undefined || thenArg === undefined) {
		dataflowLogger.warn(`If-then-else ${Identifier.toString(name.content)} has empty condition or then case in ${JSON.stringify(args)}, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const cond = processDataflowFor(condArg, data);
	if(ControlFlow.alwaysExits(cond, data.cds)) {
		dataflowLogger.warn(`If-then-else ${rootId} forces exit in condition, skipping rest`);
		return cond;
	}

	const originalDependency = data.cds?.slice();
	data = { ...data, environment: cond.environment };

	/* within a loop, what the condition reads may change after it, for the next iteration */
	const mayChange = !onlyLiterals(condArg) && withinLoop(rootId, data.completeAst.idMap);
	const values = mayChange ? undefined : NodeValue.setOf(condArg.info.id, data);
	/*
	 * `ifelse` and its relatives are ordinary functions, so R evaluates every argument whatever the condition
	 * says; only the `if` keyword leaves a branch unevaluated and may therefore be resolved away here.
	 */
	const branchesAreLazy = config?.args === undefined;
	const conditionIsAlways = (value: boolean) => branchesAreLazy && (values?.elements.every(d => d.type === 'logical' && d.value === value) ?? false);
	const alwaysFalse = conditionIsAlways(false);
	const alwaysTrue = conditionIsAlways(true);
	const uncertain = !alwaysFalse && !alwaysTrue;

	const then = alwaysFalse ? undefined : processDataflowFor(thenArg, data);
	if(then?.entryPoint) {
		then.graph.addEdge(rootId, then.entryPoint, EdgeType.Returns);
	}
	let otherwise: DataflowInformation | undefined;
	if(otherwiseArg !== undefined && !alwaysTrue) {
		data = { ...data, cds: originalDependency?.slice() };
		otherwise = processDataflowFor(otherwiseArg, data);
		if(otherwise.entryPoint) {
			otherwise.graph.addEdge(rootId, otherwise.entryPoint, EdgeType.Returns);
		}
	}

	const nextGraph = cond.graph.mergeWith(then?.graph, true, true).mergeWith(otherwise?.graph, true, true);
	const thenEnvironment = (then ?? cond).environment;
	const otherwiseEnvironment = (otherwise ?? cond).environment;
	// if there is no "else" case, we have to recover whatever we had before as it may be not executed
	let finalEnvironment: REnvironmentInformation;
	if(alwaysFalse) {
		finalEnvironment = otherwiseEnvironment;
	} else if(alwaysTrue) {
		finalEnvironment = thenEnvironment;
	} else {
		finalEnvironment = appendEnvironment(thenEnvironment, otherwiseEnvironment);
	}

	const whenTrue: ControlDependency = { id: rootId, when: true };
	const whenFalse: ControlDependency = { id: rootId, when: false };
	const cdTrue = [whenTrue];
	const cdFalse = [whenFalse];
	if(uncertain && then !== undefined) {
		makeAmbientWritesMaybe(then.environment, cond.environment, finalEnvironment, cdTrue);
	}
	if(uncertain && otherwise !== undefined) {
		makeAmbientWritesMaybe(otherwise.environment, cond.environment, finalEnvironment, cdFalse);
	}
	/*
	 * we assign all branch references with a maybe marker; we do not merge even if they appear in both branches
	 * because the maybe links will refer to different ids
	 */
	const maybe = (refs: readonly IdentifierReference[] | undefined, cds: ControlDependency[], includeDefs = false) =>
		uncertain ? makeAllMaybe(refs, nextGraph, finalEnvironment, includeDefs, cds) : refs ?? [];
	const ingoing: IdentifierReference[] = cond.in.concat(
		maybe(then?.in, cdTrue),
		maybe(otherwise?.in, cdFalse),
		cond.unknownReferences,
		maybe(then?.unknownReferences, cdTrue),
		maybe(otherwise?.unknownReferences, cdFalse),
	);
	const outgoing = cond.out.concat(maybe(then?.out, cdTrue, true), maybe(otherwise?.out, cdFalse, true));

	// a branch-local removal only happens maybe; apply it here since the branch-environment merge cannot represent it
	let killed: KillReference[] | undefined;
	if(then?.kill?.length || otherwise?.kill?.length) {
		killed = (uncertain ? makeKillsMaybe(then?.kill, cdTrue) : then?.kill ?? [])
			.concat(uncertain ? makeKillsMaybe(otherwise?.kill, cdFalse) : otherwise?.kill ?? []);
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

	const exitPoints = (then?.exitPoints ?? []).map(e => ({ ...e, cds: uncertain ? [...data.cds ?? [], { id: rootId, when: true }] : e.cds }))
		.concat((otherwise?.exitPoints ?? []).map(e => ({ ...e, cds: uncertain ? [...data.cds ?? [], { id: rootId, when: false }] : e.cds })));

	const entryOrJoin = (branch: DataflowInformation | undefined) => branch ? ControlFlow.entryOf(branch) : rootId;
	const reachesJoin = then === undefined || otherwise === undefined
		|| ControlFlow.canComplete(then) || ControlFlow.canComplete(otherwise);
	if(alwaysTrue) {
		/* the condition is known, so there is no decision left to make and only one way to go */
		ControlFlow.continuesWith(nextGraph, cond, entryOrJoin(then));
	} else if(alwaysFalse) {
		ControlFlow.continuesWith(nextGraph, cond, entryOrJoin(otherwise));
	} else {
		ControlFlow.branchesTo(nextGraph, cond, entryOrJoin(then), whenTrue);
		ControlFlow.branchesTo(nextGraph, cond, entryOrJoin(otherwise), whenFalse);
	}
	for(const branch of [then, otherwise]) {
		if(branch !== undefined) {
			ControlFlow.continuesWith(nextGraph, branch, rootId);
		}
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
