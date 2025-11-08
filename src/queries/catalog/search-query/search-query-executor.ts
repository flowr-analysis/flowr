import type { BasicQueryData } from '../../base-query-format';
import type { SearchQuery, SearchQueryResult } from './search-query-format';
import { runSearch } from '../../../search/flowr-search-executor';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FlowrSearch } from '../../../search/flowr-search-builder';

/**
 *
 */
export async function executeSearch({ analyzer }: BasicQueryData, queries: readonly SearchQuery[]): Promise<SearchQueryResult> {
	const start = Date.now();
	const results: { ids: NodeId[], search: FlowrSearch }[] = [];
	for(const query of queries) {
		const { search } = query;

		const searchResult = await runSearch(search, analyzer);

		results.push({
			ids: searchResult.getElements().map(({ node }) => node.info.id),
			search
		});
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
