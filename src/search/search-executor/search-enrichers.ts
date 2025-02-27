import type { FlowrSearchElement, FlowrSearchInput } from '../flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Pipeline } from '../../core/steps/pipeline/pipeline';

export enum Enrichment {
	CallTargets = 'call-targets'
}

const Enrichments = {
	[Enrichment.CallTargets]: (e: FlowrSearchElement<unknown>, _data: FlowrSearchInput<Pipeline>) => {
		// TODO what to return here? do we need a new EnrichedNode type? or is this already handled by the search API somehow
		return e;
	}
} as const;

// TODO the return element should be different here based on what we want to return above
export function enrich<Element extends FlowrSearchElement<ParentInformation>>(e: Element, data: FlowrSearchInput<Pipeline>, info: Enrichment): Element {
	return Enrichments[info](e, data) as Element;
}
