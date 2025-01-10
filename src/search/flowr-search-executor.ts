import type { FlowrSearch, FlowrSearchLike, SearchOutput } from './flowr-search-builder';
import { getFlowrSearch } from './flowr-search-builder';
import type { FlowrSearchElements,
	FlowrSearchInput
} from './flowr-search';


import type { Pipeline } from '../core/steps/pipeline/pipeline';
import { getGenerator } from './search-executor/search-generators';
import { getTransformer } from './search-executor/search-transformer';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';

type GetSearchElements<S> = S extends FlowrSearch<infer _, infer _, infer _, infer Elements> ? Elements extends
	FlowrSearchElements<infer _, infer E> ? E : never : never;

/**
 * Run a search with the given search query and data.
 */
export function runSearch<S extends FlowrSearchLike, P extends Pipeline>(
	search: S,
	data: FlowrSearchInput<P>
): GetSearchElements<SearchOutput<S>>  {
	const s = getFlowrSearch(search);
	return s.search.reduce(
		(acc: FlowrSearchElements<ParentInformation>, transformer) =>
			getTransformer(transformer.name)(data, acc, transformer.args as never),
		/* support multiple arguments may be abstracted away in search frontend */
		getGenerator(s.generator.name)(data, s.generator.args as never)
	).getElements() as GetSearchElements<SearchOutput<S>>;
}
