import type { BasicQueryData } from '../../base-query-format';
import { log } from '../../../util/log';
import type { SearchQuery, SearchQueryResult } from './search-query-format';
import { runSearch } from '../../../search/flowr-search-executor';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { FlowrSearch } from '../../../search/flowr-search-builder';

export function executeSearch({ ast, dataflow }: BasicQueryData, queries: readonly SearchQuery[]): SearchQueryResult {
	const start = Date.now();
	if(queries.length !== 1) {
		log.warn('Id-Map query expects only up to one query, but got', queries.length);
	}

	const results: { ids: NodeId[], search: FlowrSearch }[] = [];
	for(const query of queries) {
		const { search } = query;
		results.push({
			ids: runSearch(search, { normalize: ast, dataflow })
				.map(({ node }) => node.info.id),
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
