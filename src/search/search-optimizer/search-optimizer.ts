import type { FlowrSearchGeneratorNode, GeneratorNames } from '../search-executor/search-generators';
import type { FlowrSearchTransformerNode, TransformerNames } from '../search-executor/search-transformer';
import type { FlowrSearch } from '../flowr-search-builder';
import type { FlowrSearchElement, FlowrSearchElements } from '../flowr-search';

export function optimize<
    Info,
    Generator extends GeneratorNames,
    Transformers extends TransformerNames[],
    ElementType extends FlowrSearchElements<Info, FlowrSearchElement<Info>[]>
>(generator: FlowrSearchGeneratorNode, search: FlowrSearchTransformerNode[]): FlowrSearch<Generator, Transformers, ElementType> {
	/* TODO: optimize, e.g. drop duplicate steps, drop last after first, etc. */
	return {
		generator,
		search
	};
}
