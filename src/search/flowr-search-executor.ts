import type { FlowrSearch, FlowrSearchLike, SearchOutput } from './flowr-search-builder';
import { getFlowrSearch } from './flowr-search-builder';
import type { FlowrSearchElements } from './flowr-search';
import { getGenerator } from './search-executor/search-generators';
import { getTransformer } from './search-executor/search-transformer';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';

export type GetSearchElements<S> = S extends FlowrSearch<infer _, infer _, infer _, infer Elements> ? Elements : never;

/**
 * Run a search with the given search query and data.
 */
export async function runSearch<S extends FlowrSearchLike>(
	search: S,
	input: ReadonlyFlowrAnalysisProvider
): Promise<GetSearchElements<SearchOutput<S>>> {
	const s = getFlowrSearch(search);

	let acc: FlowrSearchElements<ParentInformation> = await getGenerator(s.generator.name)(input, s.generator.args as never);

	for(const transformer of s.search) {
		acc = await getTransformer(transformer.name)(input, acc, transformer.args as never);
	}

	return acc as GetSearchElements<SearchOutput<S>>;
}
