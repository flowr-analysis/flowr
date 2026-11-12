import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { summarizeIdsIfTooLong, queryHeader } from '../../query-print';
import type { FlowrSearch } from '../../../search/flowr-search-builder';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { flowrSearchToMermaid } from '../../../search/flowr-search-printer';
import { Mermaid } from '../../../util/mermaid/mermaid';
import { metaSince } from '../../query-meta';
import { runSearch } from '../../../search/flowr-search-executor';

/**
 * Executes the given search queries using the provided analyzer.
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
		...metaSince(start),
		results
	};
}

export interface SearchQuery extends BaseQueryFormat {
	readonly type:   'search';
	readonly search: FlowrSearch
}

export interface SearchQueryResult extends BaseQueryResult {
	readonly results: { ids: NodeId[], search: FlowrSearch }[]
}

export const SearchQueryDefinition = {
	title:           'Search Query',
	executor:        executeSearch,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'search'>['search'];
		result.push(queryHeader('search', formatter, out['.meta'].timing));
		for(const [, { ids, search }] of out.results.entries()) {
			result.push(`   ╰ [query](${Mermaid.codeToUrl(flowrSearchToMermaid(search))}): {${summarizeIdsIfTooLong(formatter, ids)}}`);
		}
		return true;
	},
	schema: Joi.object({
		type:   Joi.string().valid('search').required().description('The type of the query.'),
		search: Joi.object().required().description('The search query to execute.')
	}).description('The search query searches the normalized AST and dataflow graph for nodes that match the given search query.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'search'>['search'];
		return out.results.flatMap(({ ids }) => ids);
	}
} as const satisfies SupportedQuery<'search'>;
