import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { summarizeIdsIfTooLong } from '../../query-print';
import type { FlowrSearch } from '../../../search/flowr-search-builder';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { executeSearch } from './search-query-executor';
import { flowrSearchToMermaid } from '../../../search/flowr-search-printer';
import { mermaidCodeToUrl } from '../../../util/mermaid/mermaid';

export interface SearchQuery extends BaseQueryFormat {
	readonly type:   'search';
	readonly search: FlowrSearch
}

export interface SearchQueryResult extends BaseQueryResult {
	readonly results: { ids: NodeId[], search: FlowrSearch }[]
}

export const SearchQueryDefinition = {
	executor:        executeSearch,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'search'>['search'];
		result.push(`Query: ${bold('search', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [, { ids, search }] of out.results.entries()) {
			result.push(`   ╰ [query](${mermaidCodeToUrl(flowrSearchToMermaid(search))}): {${summarizeIdsIfTooLong(formatter, ids)}}`);
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
