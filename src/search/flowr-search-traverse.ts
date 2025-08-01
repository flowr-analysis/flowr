import type { FlowrSearchLike } from './flowr-search-builder';
import { getFlowrSearch } from './flowr-search-builder';
import type { FlowrSearchGeneratorNode } from './search-executor/search-generators';
import type { FlowrSearchTransformerNode } from './search-executor/search-transformer';

/**
 * Allows you to traverse a {@link FlowrSearchLike} object.
 */
export function traverseFlowrSearchBuilderType<
	Accumulate,
	GeneratorVisit extends(generator: FlowrSearchGeneratorNode) => Accumulate,
	TransformerVisit extends (acc: Accumulate, transformer: FlowrSearchTransformerNode) => Accumulate,
>(search: FlowrSearchLike, gen: GeneratorVisit, trans: TransformerVisit): Accumulate {
	const s = getFlowrSearch(search);
	return s.search.reduce(
		trans,
		gen(s.generator)
	);
}
