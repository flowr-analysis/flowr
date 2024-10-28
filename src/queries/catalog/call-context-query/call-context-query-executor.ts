import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type {
	CallContextQuery,
	CallContextQueryKindResult,
	CallContextQueryResult,
	CallContextQuerySubKindResult,
	SubCallContextQueryFormat
} from './call-context-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverContent } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../../../dataflow/graph/vertex';
import { edgeIncludesType, EdgeType } from '../../../dataflow/graph/edge';
import { extractCFG } from '../../../util/cfg/cfg';
import { TwoLayerCollector } from '../../two-layer-collector';
import { compactRecord } from '../../../util/objects';

import type { BasicQueryData } from '../../base-query-format';
import { identifyLinkToLastCallRelation, satisfiesCallTargets } from './identify-link-to-last-call-relation';

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
			if(!Array.isArray(subkinds[subkind])) {
				subkinds[subkind] = [];
			}
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
	return 'linkTo' in query && query.linkTo !== undefined;
}

function exactCallNameRegex(name: RegExp | string): RegExp {
	return new RegExp(`^(${name})$`);
}

function promoteQueryCallNames(queries: readonly CallContextQuery[]): { promotedQueries: CallContextQuery<RegExp>[], requiresCfg: boolean } {
	let requiresCfg = false;
	const promotedQueries = queries.map(q => {
		if(isSubCallQuery(q)) {
			requiresCfg = true;
			return {
				...q,
				callName: q.callNameExact ? exactCallNameRegex(q.callName)
					: new RegExp(q.callName),
				linkTo: {
					...q.linkTo,
					/* we have to add another promotion layer whenever we add something without this call name */
					callName: new RegExp(q.linkTo.callName)
				}
			};
		} else {
			return {
				...q,
				callName: q.callNameExact ? exactCallNameRegex(q.callName)
					: new RegExp(q.callName)
			};
		}
	});

	return { promotedQueries, requiresCfg };
}


/* maybe we want to add caches to this */
function retrieveAllCallAliases(nodeId: NodeId, graph: DataflowGraph): Map<string, NodeId[]> {
	/* we want the names of all functions called at the source id, including synonyms and returns */
	const aliases: Map<string, NodeId[]> = new Map();

	const visited = new Set<NodeId>();
	/* we store the current call name */
	const queue: (readonly [string, NodeId])[] = [[recoverContent(nodeId, graph) ?? '', nodeId]];

	while(queue.length > 0) {
		const [str, id] = queue.shift() as [string, NodeId];
		if(visited.has(id)) {
			continue;
		}
		visited.add(id);
		if(id !== nodeId) {
			const present = aliases.get(str);
			if(present) {
				present.push(id);
			} else {
				aliases.set(str, [id]);
			}
		}

		const vertex = graph.get(id);
		if(vertex === undefined) {
			continue;
		}
		const [info, outgoing] = vertex;

		if(info.tag !== VertexType.FunctionCall) {
			const x = [...outgoing]
				.filter(([,{ types }]) => edgeIncludesType(types, EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall))
				.map(([t]) => [recoverContent(t, graph) ?? '', t] as const);
			/** only follow defined-by and reads */
			queue.push(...x);
			continue;
		}

		let track = EdgeType.Calls | EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;
		if(id !== nodeId) {
			track |= EdgeType.Returns;
		}
		const out = [...outgoing]
			.filter(([, e]) => edgeIncludesType(e.types, track) && (nodeId !== id || !edgeIncludesType(e.types, EdgeType.Argument)))
			.map(([t]) => t)
		;

		for(const call of out) {
			queue.push([recoverContent(call, graph) ?? recoverContent(id, graph) ?? '', call]);
		}
	}

	return aliases;
}

function removeIdenticalDuplicates(collector: TwoLayerCollector<string, string, CallContextQuerySubKindResult>) {
	for(const [, collected] of collector.store) {
		for(const [subkind, values] of collected) {
			const seen = new Set<string>();
			const newValues = values.filter(v => {
				const str = JSON.stringify(v);
				if(seen.has(str)) {
					return false;
				}
				seen.add(str);
				return true;
			});
			collected.set(subkind, newValues);
		}
	}
}

/**
 * Multi-stage call context query resolve.
 *
 * 1. Resolve all calls in the DF graph that match the respective {@link DefaultCallContextQueryFormat#callName} regex.
 * 2. If there is an alias attached, consider all call traces.
 * 3. Identify their respective call targets, if {@link DefaultCallContextQueryFormat#callTargets} is set to be non-any.
 *    This happens during the main resolution!
 * 4. Attach `linkTo` calls to the respective calls.
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

	const queriesWhichWantAliases = promotedQueries.filter(q => q.includeAliases);

	for(const [nodeId, info] of graph.vertices(true)) {
		if(info.tag !== VertexType.FunctionCall) {
			continue;
		}
		/* if we have a vertex, and we check for aliased calls, we want to know if we define this as desired! */
		if(queriesWhichWantAliases.length > 0) {
			/*
			 * yes, we make an expensive call target check, we can probably do a lot of optimization here, e.g.,
			 * by checking all of these queries would be satisfied otherwise,
			 * in general, we first want a call to happen, i.e., trace the called targets of this!
			 */
			const targets = retrieveAllCallAliases(nodeId, graph);
			for(const [l, ids] of targets.entries()) {
				for(const query of queriesWhichWantAliases) {
					if(query.callName.test(l)) {
						initialIdCollector.add(query.kind ?? '.', query.subkind ?? '.', compactRecord({ id: nodeId, name: info.name, aliasRoots: ids }));
					}
				}
			}
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

			initialIdCollector.add(query.kind ?? '.', query.subkind ?? '.', compactRecord({ id: nodeId, name: info.name, calls: targets, linkedIds }));
		}
	}

	removeIdenticalDuplicates(initialIdCollector);

	return {
		'.meta': {
			timing: Date.now() - now,
		},
		kinds: makeReport(initialIdCollector)
	};
}

