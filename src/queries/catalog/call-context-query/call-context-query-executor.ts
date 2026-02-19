import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type {
	CallContextQuery,
	CallContextQueryKindResult,
	CallContextQueryResult,
	CallContextQuerySubKindResult,
	CallNameTypes,
	FileFilter,
	LinkTo,
	SubCallContextQueryFormat
} from './call-context-query-format';
import { type NodeId, recoverContent } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../../../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { TwoLayerCollector } from '../../two-layer-collector';
import { compactRecord } from '../../../util/objects';
import type { BasicQueryData } from '../../base-query-format';
import { satisfiesCallTargets } from './identify-link-to-last-call-relation';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../../r-bridge/lang-4.x/ast/model/processing/role';
import { CfgKind } from '../../../project/cfg-kind';
import { getCallsInCfg } from '../../../control-flow/extract-cfg';
import { identifyLinkToRelation } from './identify-link-to-relation';
import { Identifier } from '../../../dataflow/environments/identifier';

/* if the node is effected by nse, we have an ingoing nse edge */
function isQuoted(node: NodeId, graph: DataflowGraph): boolean {
	const vertex = graph.ingoingEdges(node);
	if(vertex === undefined) {
		return false;
	}
	return vertex.values().some(e => DfEdge.includesType(e, EdgeType.NonStandardEvaluation));
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

export type PromotedCallTest = (t: string) => boolean;

/**
 *
 */
export function promoteCallName(callName: CallNameTypes, exact = false): PromotedCallTest {
	if(Array.isArray(callName)) {
		const s = new Set<string>(callName);
		return (t: string) => s.has(t);
	} else if(exact) {
		const s = new Set([typeof callName === 'string' ? callName : callName.source]);
		return (t: string) => s.has(t);
	} else {
		const r = new RegExp(callName);
		return (t: string) => r.test(t);
	}
}

// when promoting queries, we convert all strings to regexes, and all string arrays to string sets
type PromotedQuery = Omit<CallContextQuery, 'callName' | 'fileFilter' | 'linkTo'> & {
	callName:    PromotedCallTest,
	fileFilter?: FileFilter<PromotedCallTest>,
	linkTo?:     PromotedLinkTo | PromotedLinkTo[]
};
export type PromotedLinkTo<LT = LinkTo> = Omit<LT, 'callName'> & { callName: PromotedCallTest };

function promoteQueryCallNames(queries: readonly CallContextQuery[]): {
	promotedQueries: PromotedQuery[],
	requiresCfg:     boolean
} {
	let requiresCfg = false;
	const promotedQueries: PromotedQuery[] = queries.map(q => {
		if(isSubCallQuery(q)) {
			requiresCfg = true;
			return {
				...q,
				callName:   promoteCallName(q.callName, q.callNameExact),
				fileFilter: q.fileFilter && {
					...q.fileFilter,
					filter: promoteCallName(q.fileFilter.filter)
				},
				linkTo: Array.isArray(q.linkTo) ? q.linkTo.map(l => ({
					...l,
					callName: promoteCallName(l.callName)
				})) : {
					...q.linkTo,
					/* we have to add another promotion layer whenever we add something without this call name */
					callName: promoteCallName(q.linkTo.callName)
				}
			} satisfies PromotedQuery;
		} else {
			return {
				...q,
				callName:   promoteCallName(q.callName, q.callNameExact),
				fileFilter: q.fileFilter && {
					...q.fileFilter,
					filter: promoteCallName(q.fileFilter.filter)
				}
			} satisfies PromotedQuery;
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
			const wantedTypes = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;
			const x = outgoing.entries()
				.filter(([,e]) => DfEdge.includesType(e, wantedTypes))
				.map(([t]) => [recoverContent(t, graph) ?? '', t] as const)
				.toArray();
			/** only follow defined-by and reads */
			queue.push(...x);
			continue;
		}

		let track = EdgeType.Calls | EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;
		if(id !== nodeId) {
			track |= EdgeType.Returns;
		}
		const out = outgoing.entries()
			.filter(([, e]) => DfEdge.includesType(e, track) && (nodeId !== id || DfEdge.doesNotIncludeType(e, EdgeType.Argument)))
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

function doesFilepathMatch(file: string | undefined, filter: FileFilter<PromotedCallTest> | undefined): boolean {
	if(filter === undefined) {
		return true;
	}
	if(file === undefined) {
		return filter.includeUndefinedFiles ?? true;
	}
	return filter.filter(file);
}

function isParameterDefaultValue(nodeId: NodeId, ast: NormalizedAst): boolean {
	let node = ast.idMap.get(nodeId);
	while(node !== undefined) {
		if(node.info.role === RoleInParent.ParameterDefaultValue) {
			return true;
		}
		const nip = node.info.parent;
		node = nip ? ast.idMap.get(nip) : undefined;
	}
	return false;
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
export async function executeCallContextQueries({ analyzer }: BasicQueryData, queries: readonly CallContextQuery[]): Promise<CallContextQueryResult> {
	const dataflow = await analyzer.dataflow();
	const ast = await analyzer.normalize();

	/* omit performance page load */
	const now = Date.now();
	/* the node id and call targets if present */
	const initialIdCollector = new TwoLayerCollector<string, string, CallContextQuerySubKindResult>();

	/* promote all strings to regex patterns */
	const { promotedQueries, requiresCfg } = promoteQueryCallNames(queries);

	let cfg = undefined;
	if(requiresCfg) {
		cfg = await analyzer.controlflow(undefined, CfgKind.Quick);
	}
	const calls = cfg ? getCallsInCfg(cfg, dataflow.graph) : undefined;
	const queriesWhichWantAliases = promotedQueries.filter(q => q.includeAliases);

	for(const [nodeId, info] of dataflow.graph.verticesOfType(VertexType.FunctionCall)) {
		/* if we have a vertex, and we check for aliased calls, we want to know if we define this as desired! */
		if(queriesWhichWantAliases.length > 0) {
			/*
			 * yes, we make an expensive call target check, we can probably do a lot of optimization here, e.g.,
			 * by checking all of these queries would be satisfied otherwise,
			 * in general, we first want a call to happen, i.e., trace the called targets of this!
			 */
			const targets = retrieveAllCallAliases(nodeId, dataflow.graph);
			for(const [l, ids] of targets.entries()) {
				for(const query of queriesWhichWantAliases) {
					if(query.callName(l)) {
						initialIdCollector.add(query.kind ?? '.', query.subkind ?? '.', compactRecord({ id: nodeId, name: info.name, aliasRoots: ids }));
					}
				}
			}
		}

		const n = Identifier.getName(info.name);
		for(const query of promotedQueries.filter(q => !q.includeAliases && q.callName(n))) {
			const file = ast.idMap.get(nodeId)?.info.file;
			if(!doesFilepathMatch(file, query.fileFilter)) {
				continue;
			}

			let targets: NodeId[] | 'no' | undefined = undefined;
			if(query.callTargets) {
				targets = satisfiesCallTargets(info, dataflow.graph, query.callTargets);
				if(targets === 'no') {
					continue;
				}
			}
			if(isQuoted(nodeId, dataflow.graph)) {
				/* if the call is quoted, we do not want to link to it */
				continue;
			} else if(query.ignoreParameterValues && isParameterDefaultValue(nodeId, ast)) {
				continue;
			}
			let linkedIds: Set<NodeId | { id: NodeId, info: object }> | undefined = undefined;
			if(cfg && 'linkTo' in query && query.linkTo !== undefined) {
				const linked = Array.isArray(query.linkTo) ? query.linkTo : [query.linkTo];
				for(const link of linked) {
					/* if we have a linkTo query, we have to find the last call */
					const linkTos = await identifyLinkToRelation(nodeId, analyzer, link, calls);
					if(linkTos) {
						linkedIds ??= new Set();
						for(const l of linkTos) {
							if(link.attachLinkInfo) {
								linkedIds.add({ id: l, info: link.attachLinkInfo });
							} else {
								linkedIds.add(l);
							}
						}
					}
				}
			}

			initialIdCollector.add(query.kind ?? '.', query.subkind ?? '.', compactRecord({
				id:        nodeId,
				name:      info.name,
				calls:     targets,
				linkedIds: linkedIds ? Array.from(linkedIds) : undefined
			}));
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
