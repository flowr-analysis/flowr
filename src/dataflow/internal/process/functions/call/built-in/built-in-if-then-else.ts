import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { alwaysExits, type DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { convertFnArguments, patchFunctionCall } from '../common';
import { unpackArg } from '../argument/unpack-argument';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { EdgeType } from '../../../../../graph/edge';
import { appendEnvironment } from '../../../../../environments/append';
import { Identifier, type IdentifierReference, ReferenceType } from '../../../../../environments/identifier';
import { type REnvironmentInformation } from '../../../../../environments/environment';
import { valueSetGuard } from '../../../../../eval/values/general';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { invertArgumentMap, pMatch } from '../../../../linker';
import { BuiltInProcName } from '../../../../../environments/built-in';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';

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

function getArguments<OtherInfo>(config: IfThenElseConfig | undefined, args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]) {
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
		const argMaps = invertArgumentMap(pMatch(convertFnArguments(args), params));
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
	args:   readonly RFunctionArgument<OtherInfo & ParentInformation>[],
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
	const values = resolveIdToValue(condArg?.info.id, { environment: data.environment, idMap: data.completeAst.idMap, resolve: data.ctx.config.solver.variables, ctx: data.ctx });
	const conditionIsAlwaysFalse = valueSetGuard(values)?.elements.every(d => d.type === 'logical' && d.value === false) ?? false;
	const conditionIsAlwaysTrue = valueSetGuard(values)?.elements.every(d => d.type === 'logical' && d.value === true) ?? false;

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

	const cdTrue = [{ id: rootId, when: true }];
	const cdFalse = [{ id: rootId, when: false }];
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

	return {
		unknownReferences: [],
		in:                [{ nodeId: rootId, name: name.content, cds: originalDependency, type: ReferenceType.Function }, ...ingoing],
		out:               outgoing,
		exitPoints,
		entryPoint:        rootId,
		environment:       finalEnvironment,
		graph:             nextGraph,
		hooks:             cond.hooks.concat(then?.hooks ?? [], otherwise?.hooks ?? []),
	};
}
