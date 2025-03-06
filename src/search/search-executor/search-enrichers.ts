import type { FlowrSearchElement, FlowrSearchInput } from '../flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { MergeableRecord } from '../../util/objects';

export interface EnrichedFlowrSearchElement<Info> extends FlowrSearchElement<Info> {
	enrichments: { [E in Enrichment]?: EnrichmentContent<E> }
}

export interface EnrichmentData<EnrichmentContent extends MergeableRecord> {
	readonly enrich: (e: FlowrSearchElement<ParentInformation>, data: FlowrSearchInput<Pipeline>) => EnrichmentContent
	/**
	 * The mapping function used by the {@link Mapper.Enrichment} mapper.
	 */
	readonly mapper: (c: EnrichmentContent) => FlowrSearchElement<ParentInformation>[]
}
export type EnrichmentContent<E extends Enrichment> = typeof Enrichments[E] extends EnrichmentData<infer Content> ? Content : never;

export enum Enrichment {
	CallTargets = 'call-targets',
	Documentation = 'documentation'
}

export const Enrichments = {
	[Enrichment.CallTargets]: {
		enrich: (e: FlowrSearchElement<ParentInformation>, data: FlowrSearchInput<Pipeline>): {targets: FlowrSearchElement<ParentInformation>[]} => {
			// TODO ok what do i actually have to do here
			return { targets: [...data.dataflow.graph.ingoingEdges(e.node.info.id) ?? []].map(([dest]) => ({ node: data.normalize.idMap.get(dest) as RNode<ParentInformation> })) };
		},
		mapper: ({ targets }: {targets: FlowrSearchElement<ParentInformation>[]}) => targets
	} satisfies EnrichmentData<{targets: FlowrSearchElement<ParentInformation>[]}>,
	[Enrichment.Documentation]: {
		enrich: (_e: FlowrSearchElement<ParentInformation>, _data: FlowrSearchInput<Pipeline>): {documentation: FlowrSearchElement<ParentInformation>[]} => {
			// TODO this should do something lmao
			return { documentation: [] };
		},
		mapper: ({ documentation }: {documentation: FlowrSearchElement<ParentInformation>[]}) => documentation
	} satisfies EnrichmentData<{documentation: FlowrSearchElement<ParentInformation>[]}>
} as const;

export function enrich<
	ElementIn extends FlowrSearchElement<ParentInformation>,
	ElementOut extends ElementIn & EnrichedFlowrSearchElement<ParentInformation>>(
	e: ElementIn, data: FlowrSearchInput<Pipeline>, enrichment: Enrichment): ElementOut {
	return {
		...e,
		enrichments: {
			...(e as ElementIn & EnrichedFlowrSearchElement<ParentInformation>)?.enrichments ?? {},
			[enrichment]: Enrichments[enrichment].enrich(e, data)
		}
	} as ElementOut;
}
