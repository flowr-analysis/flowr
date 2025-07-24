import type { FlowrSearchElement, FlowrSearchElements, FlowrSearchInput } from '../flowr-search';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';
import type { MergeableRecord } from '../../util/objects';
import { deepMergeObject } from '../../util/objects';
import { VertexType } from '../../dataflow/graph/vertex';
import type { Identifier } from '../../dataflow/environments/identifier';
import type { LinkToLastCall } from '../../queries/catalog/call-context-query/call-context-query-format';

import {
	identifyLinkToLastCallRelation
} from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { guard, isNotUndefined } from '../../util/assert';
import { extractSimpleCfg } from '../../control-flow/extract-cfg';
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';
import { type NodeId, recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { cfgAnalyzeDeadCode } from '../../control-flow/cfg-dead-code';
import { visitCfgInOrder } from '../../control-flow/simple-visitor';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';

/**
 * A {@link FlowrSearchElement} that is enriched with a set of enrichments through {@link FlowrSearchBuilder.with}.
 * Enrichments can be retrieved easily from an element through {@link enrichmentContent}.
 */
export interface EnrichedFlowrSearchElement<Info> extends FlowrSearchElement<Info> {
	enrichments: { [E in Enrichment]?: EnrichmentElementContent<E> }
}

export interface EnrichmentData<ElementContent extends MergeableRecord, Arguments = undefined, SearchContent extends MergeableRecord = never> {
	/**
	 * A function that is applied to each element of the search to enrich it with additional data.
	 */
	readonly enrichElement: (element: FlowrSearchElement<ParentInformation>, search: FlowrSearchElements<ParentInformation>, data: FlowrSearchInput<Pipeline>, args: Arguments | undefined, previousValue: ElementContent | undefined) => ElementContent
	readonly enrichSearch?: (search: FlowrSearchElements<ParentInformation>, data: FlowrSearchInput<Pipeline>, args: Arguments | undefined, previousValue: SearchContent | undefined) => SearchContent
	/**
	 * The mapping function used by the {@link Mapper.Enrichment} mapper.
	 */
	readonly mapper:        (content: ElementContent) => FlowrSearchElement<ParentInformation>[]
}
export type EnrichmentElementContent<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer ElementContent, infer _Args, infer _SearchContent> ? ElementContent : never;
export type EnrichmentSearchContent<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer _ElementContent, infer _Args, infer SearchContent> ? SearchContent : never;
export type EnrichmentArguments<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer _ElementContent, infer Args, infer _SearchContent> ? Args : never;

/**
 * An enumeration that stores the names of the available enrichments that can be applied to a set of search elements.
 * See {@link FlowrSearchBuilder.with} for more information on how to apply enrichments.
 */
export enum Enrichment {
	CallTargets = 'call-targets',
	LastCall = 'last-call',
	CfgInformation = 'cfg-information'
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
	isReachable?: boolean
}
export interface CfgInformationSearchContent extends MergeableRecord {
	simpleCfg:       ControlFlowInformation
	reachableNodes?: Set<NodeId>
}
export interface CfgInformationArguments extends MergeableRecord {
	analyzeDeadCode?: boolean
	checkReachable?:  boolean
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
				const cfg = extractSimpleCfg(data.normalize);
				for(const arg of args) {
					const lastCalls = identifyLinkToLastCallRelation(vertex[0].id, cfg.graph, data.dataflow.graph, {
						...arg,
						callName: new RegExp(arg.callName),
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
				isReachable: searchContent.reachableNodes?.has(e.node.info.id)
			};
		},
		enrichSearch: (_search, data, args, prev) => {
			// if args are not specified, they default to true
			args = deepMergeObject({
				analyzeDeadCode: true,
				checkReachable:  true
			}, args);
			const content: CfgInformationSearchContent = {
				...prev,
				simpleCfg: extractSimpleCfg(data.normalize),
			};
			if(args.analyzeDeadCode) {
				content.simpleCfg = cfgAnalyzeDeadCode(content.simpleCfg, { ast: data.normalize, dfg: data.dataflow.graph, config: data.config });
			}
			if(args.checkReachable) {
				const reachable = new Set<NodeId>();
				visitCfgInOrder(content.simpleCfg.graph, content.simpleCfg.entryPoints, node => {
					reachable.add(node);
				});
				content.reachableNodes = reachable;
			}
			return content;
		},
		mapper: _ => []
	} satisfies EnrichmentData<CfgInformationElementContent, CfgInformationArguments, CfgInformationSearchContent>
} as const;

/**
 * Returns the content of the given enrichment type from a {@link FlowrSearchElement}.
 * If the search element is not enriched with the given enrichment, `undefined` is returned.
 * @param e - The search element whose enrichment content should be retrieved.
 * @param enrichment - The enrichment content, if present, else `undefined`.
 */
export function enrichmentContent<E extends Enrichment>(e: FlowrSearchElement<ParentInformation>, enrichment: E): EnrichmentElementContent<E> {
	return (e as EnrichedFlowrSearchElement<ParentInformation>)?.enrichments?.[enrichment] as EnrichmentElementContent<E>;
}

export function enrichElement<
	ElementIn extends FlowrSearchElement<ParentInformation>,
	ElementOut extends ElementIn & EnrichedFlowrSearchElement<ParentInformation>,
	E extends Enrichment>(
	e: ElementIn, s: FlowrSearchElements<ParentInformation>, data: FlowrSearchInput<Pipeline>, enrichment: E, args?: EnrichmentArguments<E>): ElementOut {
	const enrichmentData = Enrichments[enrichment] as unknown as EnrichmentData<EnrichmentElementContent<E>, EnrichmentArguments<E>, EnrichmentSearchContent<E>>;
	const prev = (e as ElementIn & EnrichedFlowrSearchElement<ParentInformation>)?.enrichments;
	return {
		...e,
		enrichments: {
			...prev ?? {},
			[enrichment]: enrichmentData.enrichElement(e, s, data, args, prev?.[enrichment])
		}
	} as ElementOut;
}
