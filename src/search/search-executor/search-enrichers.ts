import type { FlowrSearchElement, FlowrSearchElements } from '../flowr-search';
import type {
	NormalizedAst,
	ParentInformation,
	RNodeWithParent
} from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../dataflow/info';
import { type MergeableRecord, deepMergeObject } from '../../util/objects';
import { FunctionCallVertex } from '../../dataflow/graph/vertex';
import type { LinkToLastCall } from '../../queries/catalog/call-context-query/call-context-query-format';
import { guard, isNotUndefined } from '../../util/assert';
import { type Origin, OriginType } from '../../dataflow/origin/dfg-get-origin';
import { NodeId, recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import type { Query, QueryResult } from '../../queries/query';
import { type CfgSimplificationPassName, cfgFindAllReachable, DefaultCfgSimplificationOrder } from '../../control-flow/cfg-simplification';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import type { AsyncOrSync, DeepWritable } from 'ts-essentials';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { promoteCallName } from '../../queries/catalog/call-context-query/call-context-query-executor';
import {
	identifyLinkToLastCallRelationSync
} from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { Identifier } from '../../dataflow/environments/identifier';
import { Dataflow } from '../../dataflow/graph/df-helper';
import type { KnownRoxygenTags, RoxygenTag } from '../../r-bridge/roxygen2/roxygen-ast';
import { FlowrSearchBuilder } from '../flowr-search-builder';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';


export interface EnrichmentData<ElementContent extends MergeableRecord, ElementArguments = undefined, SearchContent extends MergeableRecord = never, SearchArguments = ElementArguments> {
	/**
	 * A function that is applied to each element of the search to enrich it with additional data.
	 */
	readonly enrichElement?: (element: FlowrSearchElement<ParentInformation>, search: FlowrSearchElements<ParentInformation>, analyzer: ReadonlyFlowrAnalysisProvider, args: ElementArguments | undefined, previousValue: ElementContent | undefined) => AsyncOrSync<ElementContent>
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
	Roxygen = 'roxygen',
	QueryData = 'query-data'
}

export interface CallTargetsContent extends MergeableRecord {
	/**
	 * The call targets of the function call.
	 * For identifier call targets, the identifier is the name of the library function being called.
	 * If the `qualifyNames` argument is unset or `true`, the returned call targets will always be stringified fully-qualified identifiers.
	 */
	targets: (FlowrSearchElement<ParentInformation> | string)[];
}

/** Analysis artifacts resolved once for the whole search rather than once per element. */
export interface CallTargetsSearchContent extends MergeableRecord {
	dfg: DataflowInformation
	ast: NormalizedAst
}

export interface LastCallContent extends MergeableRecord {
	linkedIds: FlowrSearchElement<ParentInformation>[]
}

/** @see {@link CallTargetsSearchContent} */
export interface LastCallSearchContent extends CallTargetsSearchContent {
	cfg: ControlFlowInformation
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
	 * The nodes the control flow reaches, together with the syntax that holds them.
	 * Only has a value if {@link CfgInformationArguments.checkReachable} was true.
	 * @see {@link CfgInformationSearchContent.reachableNodes|reachableNodes} - for the vertices themselves
	 */
	aliveNodes?:     ReadonlySet<NodeId>
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

export interface RoxygenElementContent extends MergeableRecord {
	documentation: readonly RoxygenTag[]
	tags:          { [T in KnownRoxygenTags]?: readonly (RoxygenTag & { type: T })[] }
}

/** @see {@link CallTargetsSearchContent} */
export interface RoxygenSearchContent extends MergeableRecord {
	ast: NormalizedAst
}

export interface QueryDataElementContent extends MergeableRecord {
	/** The name of the query that this element originated from. To get each query's data, see {@link QueryDataSearchContent}. */
	query: Query['type']
}
export interface QueryDataSearchContent extends MergeableRecord {
	queries: { [QueryType in Query['type']]: Awaited<QueryResult<QueryType>> }
}

/** Roles a node can have without ever being executed on its own, which is why the control flow ignores them. */
const StructuralRoles: ReadonlySet<RoleInParent> = new Set([
	RoleInParent.FunctionCallName, RoleInParent.ArgumentName, RoleInParent.ParameterName
]);

/**
 * The nodes the control flow reaches, including everything that holds one of them.
 *
 * A construct is running as long as anything within it is, even when the construct itself is never completed
 * (an endless loop is not dead code, what follows it is), so reachability is carried from every reached vertex
 * up to the syntax around it. Marking stops at the first node that is already marked, which keeps this linear
 * instead of walking the subtree of every node.
 */
function collectAliveNodes(ast: NormalizedAst, reachable: ReadonlySet<NodeId>): ReadonlySet<NodeId> {
	const alive = new Set<NodeId>();
	for(const id of reachable) {
		let node = ast.idMap.get(id);
		while(node !== undefined && !alive.has(node.info.id)) {
			alive.add(node.info.id);
			node = node.info.parent === undefined ? undefined : ast.idMap.get(node.info.parent);
		}
	}
	return alive;
}

/**
 * Whether the control flow reaches this node.
 *
 * The graph's vertices are the nodes that make up the execution of a program; syntax that only names something
 * (the name of a call or of an argument) is never reached on its own and is judged by what it names instead.
 */
function isReachedByControlFlow(node: RNodeWithParent, alive: ReadonlySet<NodeId>): boolean {
	if(alive.has(node.info.id)) {
		return true;
	} else if(StructuralRoles.has(node.info.role)) {
		return node.info.parent !== undefined && alive.has(node.info.parent);
	}
	return false;
}

/**
 * The registry of enrichments that are currently supported by the search.
 * See {@link FlowrSearchBuilder.with} for more information on how to apply enrichments.
 */
export const Enrichments = {
	[Enrichment.CallTargets]: {
		enrichSearch: async(_search, data, _args, prev) => prev ?? {
			dfg: await data.dataflow(),
			ast: await data.normalize()
		},
		enrichElement: async(e, s, analyzer, args, prev) => {
			// we don't resolve aliases here yet!
			const content: CallTargetsContent = { targets: [] };
			const shared = s.enrichmentContent(Enrichment.CallTargets) as CallTargetsSearchContent | undefined;
			const df = shared?.dfg ?? await analyzer.dataflow();
			const n = shared?.ast ?? await analyzer.normalize();
			const callVertex = df.graph.getVertex(e.node.info.id);
			if(FunctionCallVertex.is(callVertex)) {
				const origins = Dataflow.origin(df.graph, callVertex.id);
				if(!origins || origins.length === 0) {
					const name = recoverName(callVertex.id, n.idMap);
					// we don't have origin information here, so pass undefined
					content.targets = [qualifyIdentifier(undefined, name)] as (FlowrSearchElement<ParentInformation> | string)[];
				} else {
					// find call targets in user code (which have ids!)
					content.targets = origins.map(o => {
						switch(o.type) {
							case OriginType.FunctionCallOrigin: {
								if(NodeId.isBuiltIn(o.id)) {
									// a built-in target (e.g. a materialized package export from `library()`) has no
									// user-code node, so surface it as a built-in identifier (see `onlyBuiltin` below)
									const name = recoverName(o.id, n.idMap);
									return qualifyIdentifier([o], name) ?? String(o.id);
								} else {
									return { node: n.idMap.get(o.id) as RNodeWithParent } satisfies FlowrSearchElement<ParentInformation>;
								}
							}
							case OriginType.BuiltInFunctionOrigin:
								return qualifyIdentifier([o], o.fn.name);
							default:
								return undefined;
						}
					}).filter(isNotUndefined);
					if(content.targets.length === 0) {
						const name = recoverName(callVertex.id, n.idMap);
						content.targets = [qualifyIdentifier(origins, name)] as (FlowrSearchElement<ParentInformation> | string)[];
					}
				}
			}

			// keep only calls whose targets are all built-in; library/package exports arrive as an identifier
			// targets and count as built-in, a target with a `node` is user code and disqualifies the call
			if(args?.onlyBuiltin && content.targets.some(t => typeof t !== 'string')) {
				content.targets = [];
			}

			if(prev) {
				content.targets.push(...prev.targets);
			}
			return content;

			function qualifyIdentifier(origins: readonly Origin[] | undefined, name?: Identifier) {
				if(args?.qualifyNames === undefined || args.qualifyNames) {
					const qualified = Identifier.toQualified(origins, name);
					if(qualified !== undefined) {
						return Identifier.toString(qualified);
					}
				}
				return name as string;
			}
		},
		// as built-in call target enrichments are not nodes, we don't return them as part of the mapper!
		mapper: ({ targets }) => targets.map(t => t as FlowrSearchElement<ParentInformation>).filter(t => t.node !== undefined)
	} satisfies EnrichmentData<CallTargetsContent, { onlyBuiltin?: boolean, qualifyNames?: boolean }, CallTargetsSearchContent>,
	[Enrichment.LastCall]: {
		enrichSearch: async(_search, data, _args, prev) => prev ?? {
			dfg: await data.dataflow(),
			ast: await data.normalize(),
			cfg: await data.controlflow(undefined)
		},
		enrichElement: async(e, s, analyzer, args, prev) => {
			guard(args && args.length, `${Enrichment.LastCall} enrichment requires at least one argument`);
			const content = prev ?? { linkedIds: [] };
			const shared = s.enrichmentContent(Enrichment.LastCall) as LastCallSearchContent | undefined;
			const df = (shared?.dfg ?? await analyzer.dataflow()).graph;
			const vertex = df.getVertex(e.node.info.id);
			if(FunctionCallVertex.is(vertex)) {
				const n = shared?.ast ?? await analyzer.normalize();
				const cfg = (shared?.cfg ?? await analyzer.controlflow(undefined)).graph;
				for(const arg of args) {
					const lastCalls = identifyLinkToLastCallRelationSync(vertex.id, cfg, df, {
						...arg,
						callName: promoteCallName(arg.callName),
						type:     'link-to-last-call',
					});
					for(const lastCall of lastCalls) {
						content.linkedIds.push({ node: n.idMap.get(lastCall) as RNodeWithParent });
					}
				}
			}
			return content;
		},
		mapper: ({ linkedIds }) => linkedIds
	} satisfies EnrichmentData<LastCallContent, Omit<LinkToLastCall, 'type'>[], LastCallSearchContent>,
	[Enrichment.CfgInformation]: {
		enrichElement: (e, search, _data, _args, prev) => {
			const searchContent: CfgInformationSearchContent = search.enrichmentContent(Enrichment.CfgInformation);
			return {
				...prev,
				isRoot:      searchContent.cfg.graph.rootIds().has(e.node.info.id),
				isReachable: searchContent.reachableNodes === undefined ? undefined
					: isReachedByControlFlow(e.node, searchContent.aliveNodes ?? searchContent.reachableNodes)
			};
		},
		enrichSearch: async(_search, data, args, prev) => {
			args = {
				forceRefresh:         false,
				checkReachable:       false,
				simplificationPasses: DefaultCfgSimplificationOrder,
				...args
			};

			// short-circuit if we already have a cfg stored (and the reachability info if requested)
			if(!args.forceRefresh && prev?.cfg && (!args.checkReachable || prev.reachableNodes)) {
				return prev;
			}

			const content: CfgInformationSearchContent = {
				...prev,
				cfg: await data.controlflow(args.simplificationPasses),
			};
			if(args.checkReachable) {
				content.reachableNodes = cfgFindAllReachable(content.cfg);
				content.aliveNodes = collectAliveNodes(await data.normalize(), content.reachableNodes);
			}
			return content;
		}
	} satisfies EnrichmentData<CfgInformationElementContent, CfgInformationArguments, CfgInformationSearchContent>,
	[Enrichment.Roxygen]: {
		enrichSearch:  async(_search, data, _args, prev) => prev ?? { ast: await data.normalize() },
		enrichElement: async(e, search, analyzer, _args, prev) => {
			const content = (prev ?? {
				documentation: [],
				tags:          {}
			}) as DeepWritable<RoxygenElementContent>;

			const shared = search.enrichmentContent(Enrichment.Roxygen) as RoxygenSearchContent | undefined;
			const normalize = shared?.ast ?? await analyzer.normalize();
			const roxygen = RNode.documentation(e.node.info.id, normalize.idMap);
			if(roxygen !== undefined) {
				const comments = (Array.isArray(roxygen) ? roxygen : [roxygen]) as RoxygenTag[];
				content.documentation.push(...comments);
				for(const comment of comments) {
					content.tags[comment.type] ??= [];
					(content.tags[comment.type] as RoxygenTag[]).push(comment);
				}
			}

			return content;
		}
	} satisfies EnrichmentData<RoxygenElementContent, undefined, RoxygenSearchContent>,
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
	e: Element, s: FlowrSearchElements<ParentInformation>, analyzer: ReadonlyFlowrAnalysisProvider, enrichment: E, args?: EnrichmentElementArguments<E>): Promise<Element> {
	const enrichmentData = Enrichments[enrichment] as unknown as EnrichmentData<EnrichmentElementContent<E>, EnrichmentElementArguments<E>>;
	const prev = e?.enrichments;
	return {
		...e,
		enrichments: {
			...prev ?? {},
			[enrichment]: await enrichmentData.enrichElement?.(e, s, analyzer, args, prev?.[enrichment])
		}
	};
}
