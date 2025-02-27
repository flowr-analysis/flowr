import type { FlowrSearchElement, FlowrSearchInput } from '../flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';

export interface EnrichedFlowrSearchElement<Info> extends FlowrSearchElement<Info> {
	// TODO using unknown like this doesn't give us any information about the type of the enrichments' data -> we need to gather it from the Enrichments collection below somehow
	enrichments: { [E in Enrichment]?: unknown }
}

export enum Enrichment {
	CallTargets = 'call-targets'
}

const Enrichments = {
	[Enrichment.CallTargets]: (e: FlowrSearchElement<ParentInformation>, data: FlowrSearchInput<Pipeline>) => {
		// TODO i don't think this is correct but we just wanna do *something* for now
		return [...data.dataflow.graph.ingoingEdges(e.node.info.id) ?? []].map(([dest]) => dest);
	}
} as const;

export function enrich<
	ElementIn extends FlowrSearchElement<ParentInformation>,
	ElementOut extends ElementIn & EnrichedFlowrSearchElement<ParentInformation>>(
	e: ElementIn, data: FlowrSearchInput<Pipeline>, info: Enrichment): ElementOut {
	return {
		...e,
		enrichments: {
			...(e as ElementIn & EnrichedFlowrSearchElement<ParentInformation>)?.enrichments ?? {},
			[info]: Enrichments[info](e, data)
		}
	} as ElementOut;
}
