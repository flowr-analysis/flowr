import type { DataflowGraph } from '../../dataflow/graph/graph';
import type {
	CallContextQuery,
	CallContextQueryKindResult,
	CallContextQueryResult, CallContextQuerySubKindResult,
	SubCallContextQueryFormat
} from './call-context-query-format';
import { CallTargets
} from './call-context-query-format';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../../dataflow/graph/vertex';
import { assertUnreachable } from '../../util/assert';
import { edgeIncludesType, EdgeType } from '../../dataflow/graph/edge';
import { resolveByName } from '../../dataflow/environments/resolve-by-name';
import { BuiltIn } from '../../dataflow/environments/built-in';
import type { ControlFlowGraph } from '../../util/cfg/cfg';
import {  extractCFG } from '../../util/cfg/cfg';
import { TwoLayerCollector } from '../two-layer-collector';
import type { BasicQueryData } from '../query';
import { compactRecord } from '../../util/objects';
import { visitInReverseOrder } from '../../util/cfg/visitor';

function satisfiesCallTargets(id: NodeId, graph: DataflowGraph, callTarget: CallTargets): NodeId[] | 'no'  {
	const callVertex = graph.get(id);
	if(callVertex === undefined || callVertex[0].tag !== VertexType.FunctionCall) {
		return 'no';
	}
	const [info,outgoing] = callVertex;
	const callTargets = [...outgoing]
		.filter(([, e]) => edgeIncludesType(e.types, EdgeType.Calls))
		.map(([t]) => t)
	;

	let builtIn = false;

	if(info.environment === undefined) {
		/* if we have a call with an unbound environment,
		 * this only happens if we are sure of built-in relations and want to save references
		 */
		builtIn = true;
	} else {
		/*
		 * for performance and scoping reasons, flowR will not identify the global linkage,
		 * including any potential built-in mapping.
		 */
		const reResolved = resolveByName(info.name, info.environment);
		if(reResolved && reResolved.some(t => t.definedAt === BuiltIn)) {
			builtIn = true;
		}
	}

	switch(callTarget) {
		case CallTargets.Any:
			return callTargets;
		case CallTargets.OnlyGlobal:
			return builtIn && callTargets.length === 0 ? [BuiltIn] : 'no';
		case CallTargets.MustIncludeGlobal:
			return builtIn ? [...callTargets, BuiltIn] : 'no';
		case CallTargets.OnlyLocal:
			return !builtIn && callTargets.length > 0 ? callTargets : 'no';
		case CallTargets.MustIncludeLocal:
			if(callTargets.length > 0) {
				return builtIn ? [...callTargets, BuiltIn] : callTargets;
			} else {
				return 'no';
			}
		default:
			assertUnreachable(callTarget);
	}
}

/* if the node is effected by nse, we have an ingoing nse edge */
function isQuoted(node: NodeId, graph: DataflowGraph): boolean {
	const vertex = graph.ingoingEdges(node);
	if(vertex === undefined) {
		return false;
	}
	return [...vertex.values()].some(({ types }) => edgeIncludesType(types, EdgeType.NonStandardEvaluation));
}

function makeReport(collector: TwoLayerCollector<string, string, CallContextQuerySubKindResult>): CallContextQueryKindResult {
	const result: CallContextQueryKindResult = {} as unknown as CallContextQueryKindResult;
	for(const [kind, collected] of collector.store) {
		const subkinds = {} as CallContextQueryKindResult[string]['subkinds'];
		for(const [subkind, values] of collected) {
			subkinds[subkind] ??= [];
			const collectIn = subkinds[subkind];
			for(const value of values) {
				collectIn.push(value);
			}
		}
		result[kind] = {
			subkinds
		};
	}
	return result;
}

function isSubCallQuery(query: CallContextQuery): query is SubCallContextQueryFormat {
	return 'linkTo' in query;
}

function promoteQueryCallNames(queries: readonly CallContextQuery[]): { promotedQueries: CallContextQuery<RegExp>[], requiresCfg: boolean } {
	let requiresCfg = false;
	const promotedQueries = queries.map(q => {
		if(isSubCallQuery(q)) {
			requiresCfg = true;
			return {
				...q,
				callName: new RegExp(q.callName),
				linkTo:   {
					...q.linkTo,
					/* we have to add another promotion layer whenever we add something without this call name */
					callName: new RegExp(q.linkTo.callName)
				}
			};
		} else {
			return {
				...q,
				callName: new RegExp(q.callName)
			};
		}
	});

	return { promotedQueries, requiresCfg };
}

function identifyLinkToLastCallRelation(from: NodeId, cfg: ControlFlowGraph, graph: DataflowGraph, linkTo: RegExp): NodeId[] {
	const found: NodeId[] = [];
	visitInReverseOrder(cfg, from, node => {
		/* we ignore the start id as it cannot be the last call */
		if(node === from) {
			return;
		}
		const vertex = graph.getVertex(node);
		if(vertex === undefined || vertex.tag !== VertexType.FunctionCall) {
			return;
		}
		if(linkTo.test(vertex.name)) {
			found.push(node);
			return true;
		}
	});
	return found;
}

/**
 * Multi-stage call context query resolve.
 *
 * 1. Resolve all calls in the DF graph that match the respective {@link DefaultCallContextQueryFormat#callName} regex.
 * 2. Identify their respective call targets, if {@link DefaultCallContextQueryFormat#callTargets} is set to be non-any.
 *    This happens during the main resolution!
 * 3. Attach `linkTo` calls to the respective calls.
 */
export function executeCallContextQueries({ graph, ast }: BasicQueryData, queries: readonly CallContextQuery[]): CallContextQueryResult {
	/* omit performance page load */
	const now = Date.now();
	/* the node id and call targets if present */
	const initialIdCollector = new TwoLayerCollector<string, string, CallContextQuerySubKindResult>();

	/* promote all strings to regex patterns */
	const { promotedQueries, requiresCfg } = promoteQueryCallNames(queries);

	let cfg = undefined;
	if(requiresCfg) {
		cfg = extractCFG(ast);
	}

	for(const [nodeId, info] of graph.vertices(true)) {
		if(info.tag !== VertexType.FunctionCall) {
			continue;
		}
		for(const query of promotedQueries.filter(q => q.callName.test(info.name))) {
			let targets: NodeId[] | 'no' | undefined = undefined;
			if(query.callTargets) {
				targets = satisfiesCallTargets(nodeId, graph, query.callTargets);
				if(targets === 'no') {
					continue;
				}
			}
			if(isQuoted(nodeId, graph)) {
				/* if the call is quoted, we do not want to link to it */
				continue;
			}
			let linkedIds: NodeId[] | undefined = undefined;
			if(cfg && isSubCallQuery(query)) {
				/* if we have a linkTo query, we have to find the last call */
				const lastCall = identifyLinkToLastCallRelation(nodeId, cfg.graph, graph, query.linkTo.callName);
				if(lastCall) {
					linkedIds = lastCall;
				}
			}

			initialIdCollector.add(query.kind, query.subkind, compactRecord({ id: nodeId, calls: targets, linkedIds }));
		}
	}

	console.log(initialIdCollector.asciiSummary());

	return {
		'.meta': {
			timing: Date.now() - now
		},
		kinds: makeReport(initialIdCollector)
	};
}

