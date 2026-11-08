import { type FlowrSearch, type FlowrSearchLike, type SearchOutput, getFlowrSearch } from './flowr-search-builder';
import type { FlowrSearchElements } from './flowr-search';
import { runGenerator } from './search-executor/search-generators';
import { runTransformer } from './search-executor/search-transformer';
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

	let acc: FlowrSearchElements<ParentInformation> = await runGenerator(s.generator, input);

	for(const transformer of s.search) {
		acc = await runTransformer(transformer, input, acc);
	}

	return acc as GetSearchElements<SearchOutput<S>>;
}
