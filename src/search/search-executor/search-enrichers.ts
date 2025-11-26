import type { FlowrSearchElement, FlowrSearchElements } from '../flowr-search';
import type {
	NormalizedAst,
	ParentInformation,
	RNodeWithParent
} from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type MergeableRecord , deepMergeObject } from '../../util/objects';
import { VertexType } from '../../dataflow/graph/vertex';
import type { Identifier } from '../../dataflow/environments/identifier';
import type { LinkToLastCall } from '../../queries/catalog/call-context-query/call-context-query-format';
import {
	identifyLinkToLastCallRelation
} from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { guard, isNotUndefined } from '../../util/assert';
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';
import { type NodeId, recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import type { Query, QueryResult } from '../../queries/query';
import { type CfgSimplificationPassName , cfgFindAllReachable, DefaultCfgSimplificationOrder } from '../../control-flow/cfg-simplification';
import type { AsyncOrSync, AsyncOrSyncType } from 'ts-essentials';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import type { DataflowInformation } from '../../dataflow/info';
import { promoteCallName } from '../../queries/catalog/call-context-query/call-context-query-executor';
import { CfgKind } from '../../project/cfg-kind';
import type { FlowrConfigOptions } from '../../config';


export interface EnrichmentData<ElementContent extends MergeableRecord, ElementArguments = undefined, SearchContent extends MergeableRecord = never, SearchArguments = ElementArguments> {
	/**
	 * A function that is applied to each element of the search to enrich it with additional data.
	 */
	readonly enrichElement?: (element: FlowrSearchElement<ParentInformation>, search: FlowrSearchElements<ParentInformation>, data: {dataflow: DataflowInformation, normalize: NormalizedAst, cfg: ControlFlowInformation, config: FlowrConfigOptions}, args: ElementArguments | undefined, previousValue: ElementContent | undefined) => AsyncOrSync<ElementContent>
	readonly enrichSearch?:  (search: FlowrSearchElements<ParentInformation>, data: ReadonlyFlowrAnalysisProvider, args: SearchArguments | undefined, previousValue: SearchContent | undefined) => AsyncOrSync<SearchContent>
	/**
	 * The mapping function used by the {@link Mapper.Enrichment} mapper.
	 */
	readonly mapper?:        (content: ElementContent) => FlowrSearchElement<ParentInformation>[]
}
export type EnrichmentElementContent<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer EC, infer _EA, infer _SC, infer _SA> ? EC : never;
export type EnrichmentElementArguments<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer _EC, infer EA, infer _SC, infer _SA> ? EA : never;
export type EnrichmentSearchContent<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer _EC, infer _EA, infer SC, infer _SA> ? SC : never;
export type EnrichmentSearchArguments<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer _EC, infer _EA, infer _SC, infer SA> ? SA : never;

/**
 * An enumeration that stores the names of the available enrichments that can be applied to a set of search elements.
 * See {@link FlowrSearchBuilder.with} for more information on how to apply enrichments.
 */
export enum Enrichment {
	CallTargets = 'call-targets',
	LastCall = 'last-call',
	CfgInformation = 'cfg-information',
	QueryData = 'query-data'
}

export interface CallTargetsContent extends MergeableRecord {
	/**
	 * The call targets of the function call.
	 * For identifier call targets, the identifier is the name of the library function being called.
	 */
	targets: (FlowrSearchElement<ParentInformation> | Identifier)[];
}

export interface LastCallContent extends MergeableRecord {
	linkedIds: FlowrSearchElement<ParentInformation>[]
}

export interface CfgInformationElementContent extends MergeableRecord {
	/**
	 * Whether the current node is a root node in the CFG, which is a node that is not contained inside of a function definition.
	 */
	isRoot:       boolean
	/**
	 * Whether the current node is reachable from the root of the CFG.
	 * Only has a value if {@link CfgInformationArguments.checkReachable} was true.
	 */
	isReachable?: boolean
}
export interface CfgInformationSearchContent extends MergeableRecord {
	/**
	 * The CFG attached to the search, extracted using {@link extractCfg}.
	 */
	cfg:             ControlFlowInformation
	/**
	 * The set of all nodes that are reachable from the root of the CFG, extracted using {@link visitCfgInOrder}.
	 * Only has a value if {@link CfgInformationArguments.checkReachable} was true.
	 */
	reachableNodes?: Set<NodeId>
}
export interface CfgInformationArguments extends MergeableRecord {
	/** Whether to recalculate the CFG information if it already exists on the current search. Defaults to `false`. */
	forceRefresh?:         boolean
	/** The simplification passes that should be run on the extracted CFG. Defaults to the entries of {@link DefaultCfgSimplificationOrder}. */
	simplificationPasses?: CfgSimplificationPassName[]
	/** Whether to check nodes for reachability, and subsequently set {@link CfgInformationSearchContent.reachableNodes} and {@link CfgInformationElementContent.isReachable}. Defaults to `false`. */
	checkReachable?:       boolean
}

export interface QueryDataElementContent extends MergeableRecord {
	/** The name of the query that this element originated from. To get each query's data, see {@link QueryDataSearchContent}. */
	query: Query['type']
}

export interface QueryDataSearchContent extends MergeableRecord {
	queries: { [QueryType in Query['type']]: Awaited<QueryResult<QueryType>> }
}

/**
 * The registry of enrichments that are currently supported by the search.
 * See {@link FlowrSearchBuilder.with} for more information on how to apply enrichments.
 */
export const Enrichments = {
	[Enrichment.CallTargets]: {
		enrichElement: (e, _s, data, args, prev) => {
			// we don't resolve aliases here yet!
			const content: CallTargetsContent = { targets: [] };
			const callVertex = data.dataflow.graph.getVertex(e.node.info.id);
			if(callVertex?.tag === VertexType.FunctionCall) {
				const origins = getOriginInDfg(data.dataflow.graph, callVertex.id);
				if(!origins || origins.length === 0) {
					content.targets = [recoverName(callVertex.id, data.normalize.idMap)] as (FlowrSearchElement<ParentInformation> | Identifier)[];
				} else {
					// find call targets in user code (which have ids!)
					content.targets = content.targets.concat(
						origins.map(o => {
							switch(o.type) {
								case OriginType.FunctionCallOrigin:
									return {
										node: data.normalize.idMap.get(o.id) as RNodeWithParent,
									} satisfies FlowrSearchElement<ParentInformation>;
								case OriginType.BuiltInFunctionOrigin:
									return o.fn.name;
								default:
									return undefined;
							}
						}).filter(isNotUndefined)
					);
					if(content.targets.length === 0) {
						content.targets = [recoverName(callVertex.id, data.normalize.idMap)] as (FlowrSearchElement<ParentInformation> | Identifier)[];
					}
				}
			}

			// if there is a call target that is not built-in (ie a custom function), we don't want to include it here
			if(args?.onlyBuiltin && content.targets.some(t => typeof t !== 'string')) {
				content.targets = [];
			}

			if(prev) {
				content.targets.push(...prev.targets);
			}
			return content;
		},
		// as built-in call target enrichments are not nodes, we don't return them as part of the mapper!
		mapper: ({ targets }) => targets.map(t => t as FlowrSearchElement<ParentInformation>).filter(t => t.node !== undefined)
	} satisfies EnrichmentData<CallTargetsContent, {onlyBuiltin?: boolean}>,
	[Enrichment.LastCall]: {
		enrichElement: (e, _s, data, args, prev) => {
			guard(args && args.length, `${Enrichment.LastCall} enrichment requires at least one argument`);
			const content = prev ?? { linkedIds: [] };
			const vertex = data.dataflow.graph.get(e.node.info.id);
			if(vertex !== undefined && vertex[0].tag === VertexType.FunctionCall) {
				for(const arg of args) {
					const lastCalls = identifyLinkToLastCallRelation(vertex[0].id, data.cfg.graph, data.dataflow.graph, {
						...arg,
						callName: promoteCallName(arg.callName),
						type:     'link-to-last-call',
					});
					for(const lastCall of lastCalls) {
						content.linkedIds.push({ node: data.normalize.idMap.get(lastCall) as RNodeWithParent });
					}
				}
			}
			return content;
		},
		mapper: ({ linkedIds }) => linkedIds
	} satisfies EnrichmentData<LastCallContent, Omit<LinkToLastCall, 'type'>[]>,
	[Enrichment.CfgInformation]: {
		enrichElement: (e, search, _data, _args, prev) => {
			const searchContent: CfgInformationSearchContent = search.enrichmentContent(Enrichment.CfgInformation);
			return {
				...prev,
				isRoot:      searchContent.cfg.graph.rootIds().has(e.node.info.id),
				isReachable: searchContent.reachableNodes?.has(e.node.info.id)
			};
		},
		enrichSearch: async(_search, data, args, prev) => {
			args = {
				forceRefresh:         false,
				checkReachable:       false,
				simplificationPasses: DefaultCfgSimplificationOrder,
				...args
			};

			// short-circuit if we already have a cfg stored
			if(!args.forceRefresh && prev?.simpleCfg) {
				return prev;
			}

			const content: CfgInformationSearchContent = {
				...prev,
				cfg: await data.controlflow(args.simplificationPasses, CfgKind.WithDataflow),
			};
			if(args.checkReachable) {
				content.reachableNodes = cfgFindAllReachable(content.cfg);
			}
			return content;
		}
	} satisfies EnrichmentData<CfgInformationElementContent, CfgInformationArguments, AsyncOrSyncType<CfgInformationSearchContent>>,
	[Enrichment.QueryData]: {
		// the query data enrichment is just a "pass-through" that passes the query data to the underlying search
		enrichElement: (_e, _search, _data, args, prev) => (args ?? prev) as QueryDataElementContent,
		enrichSearch:  (_search, _data, args, prev) => deepMergeObject(prev as QueryDataSearchContent, args)
	} satisfies EnrichmentData<QueryDataElementContent, QueryDataElementContent, QueryDataSearchContent, QueryDataSearchContent>
} as const;

/**
 * Returns the content of the given enrichment type from a {@link FlowrSearchElement}.
 * If the search element is not enriched with the given enrichment, `undefined` is returned.
 * @param e - The search element whose enrichment content should be retrieved.
 * @param enrichment - The enrichment content, if present, else `undefined`.
 */
export function enrichmentContent<E extends Enrichment>(e: FlowrSearchElement<ParentInformation>, enrichment: E): EnrichmentElementContent<E> {
	return e?.enrichments?.[enrichment] as EnrichmentElementContent<E>;
}

/**
 * Enriches the given search element with the given enrichment type, using the provided analysis data.
 */
export async function enrichElement<Element extends FlowrSearchElement<ParentInformation>, E extends Enrichment>(
	e: Element, s: FlowrSearchElements<ParentInformation>, data: {
		dataflow:  DataflowInformation,
		normalize: NormalizedAst,
		cfg:       ControlFlowInformation,
		config:    FlowrConfigOptions
	}, enrichment: E, args?: EnrichmentElementArguments<E>): Promise<Element> {
	const enrichmentData = Enrichments[enrichment] as unknown as EnrichmentData<EnrichmentElementContent<E>, EnrichmentElementArguments<E>>;
	const prev = e?.enrichments;
	return {
		...e,
		enrichments: {
			...prev ?? {},
			[enrichment]: await enrichmentData.enrichElement?.(e, s, data, args, prev?.[enrichment])
		}
	};
}
