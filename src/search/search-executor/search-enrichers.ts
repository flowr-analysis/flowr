import type { FlowrSearchElement, FlowrSearchInput } from '../flowr-search';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';
import type { MergeableRecord } from '../../util/objects';
import { VertexType } from '../../dataflow/graph/vertex';
import type { Identifier } from '../../dataflow/environments/identifier';
import type { LinkToLastCall } from '../../queries/catalog/call-context-query/call-context-query-format';
import {
	identifyLinkToLastCallRelation
} from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { guard, isNotUndefined } from '../../util/assert';
import { extractSimpleCfg } from '../../control-flow/extract-cfg';
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';
import { recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

/**
 * A {@link FlowrSearchElement} that is enriched with a set of enrichments through {@link FlowrSearchBuilder.with}.
 * Enrichments can be retrieved easily from an element through {@link enrichmentContent}.
 */
export interface EnrichedFlowrSearchElement<Info> extends FlowrSearchElement<Info> {
	enrichments: { [E in Enrichment]?: EnrichmentContent<E> }
}

export interface EnrichmentData<EnrichmentContent extends MergeableRecord, EnrichmentArguments = undefined> {
	/**
	 * A function that is applied to each element of the search to enrich it with additional data.
	 */
	readonly enrich: (e: FlowrSearchElement<ParentInformation>, data: FlowrSearchInput<Pipeline>, args: EnrichmentArguments | undefined) => EnrichmentContent
	/**
	 * The mapping function used by the {@link Mapper.Enrichment} mapper.
	 */
	readonly mapper: (c: EnrichmentContent) => FlowrSearchElement<ParentInformation>[]
}
export type EnrichmentContent<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer Content, infer _Args> ? Content : never;
export type EnrichmentArguments<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer _Content, infer Args> ? Args : never;

/**
 * An enumeration that stores the names of the available enrichments that can be applied to a set of search elements.
 * See {@link FlowrSearchBuilder.with} for more information on how to apply enrichments.
 */
export enum Enrichment {
	CallTargets = 'call-targets',
	LastCall = 'last-call'
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

/**
 * The registry of enrichments that are currently supported by the search.
 * See {@link FlowrSearchBuilder.with} for more information on how to apply enrichments.
 */
export const Enrichments = {
	[Enrichment.CallTargets]: {
		enrich: (e, data) => {
			// we don't resolve aliases here yet!
			const content: CallTargetsContent = { targets: [] };
			const callVertex = data.dataflow.graph.getVertex(e.node.info.id);
			if(callVertex?.tag === VertexType.FunctionCall) {
				const origins = getOriginInDfg(data.dataflow.graph, callVertex.id);
				if(!origins || origins.length === 0) {
					content.targets = [recoverName(callVertex.id, data.normalize.idMap)] as (FlowrSearchElement<ParentInformation> | Identifier)[];
					return content;
				}
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
			return content;
		},
		// as built-in call target enrichments are not nodes, we don't return them as part of the mapper!
		mapper: ({ targets }) => targets.map(t => t as FlowrSearchElement<ParentInformation>).filter(t => t.node !== undefined)
	} satisfies EnrichmentData<CallTargetsContent>,
	[Enrichment.LastCall]: {
		enrich: (e, data, args) => {
			guard(args && args.length, `${Enrichment.LastCall} enrichment requires at least one argument`);
			const content: LastCallContent = { linkedIds: [] };
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
} as const;

/**
 * Returns the content of the given enrichment type from a {@link FlowrSearchElement}.
 * If the search element is not enriched with the given enrichment, `undefined` is returned.
 * @param e - The search element whose enrichment content should be retrieved.
 * @param enrichment - The enrichment content, if present, else `undefined`.
 */
export function enrichmentContent<E extends Enrichment>(e: FlowrSearchElement<ParentInformation>, enrichment: E): EnrichmentContent<E> {
	return (e as EnrichedFlowrSearchElement<ParentInformation>)?.enrichments?.[enrichment] as EnrichmentContent<E>;
}

export function enrich<
	ElementIn extends FlowrSearchElement<ParentInformation>,
	ElementOut extends ElementIn & EnrichedFlowrSearchElement<ParentInformation>,
	ConcreteEnrichment extends Enrichment>(
	e: ElementIn, data: FlowrSearchInput<Pipeline>, enrichment: ConcreteEnrichment, args?: EnrichmentArguments<ConcreteEnrichment>): ElementOut {
	const enrichmentData = Enrichments[enrichment] as unknown as EnrichmentData<EnrichmentContent<ConcreteEnrichment>, EnrichmentArguments<ConcreteEnrichment>>;
	return {
		...e,
		enrichments: {
			...(e as ElementIn & EnrichedFlowrSearchElement<ParentInformation>)?.enrichments ?? {},
			[enrichment]: enrichmentData.enrich(e, data, args)
		}
	} as ElementOut;
}
