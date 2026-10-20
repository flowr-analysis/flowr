import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { AstIdMap } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeIdMapQuery } from './id-map-query-executor';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { summarizeIdsIfTooLong, queryHeader } from '../../query-print';

export interface IdMapQuery extends BaseQueryFormat {
	readonly type: 'id-map';
}

export interface IdMapQueryResult extends BaseQueryResult {
	readonly idMap: AstIdMap;
}

export const IdMapQueryDefinition = {
	title:           'Id-Map Query',
	executor:        executeIdMapQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'id-map'>['id-map'];
		result.push(queryHeader('id-map', formatter, out['.meta'].timing));
		result.push(`   ╰ Id List: {${summarizeIdsIfTooLong(formatter, Array.from(out.idMap.keys()))}}`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('id-map').required().description('The type of the query.'),
	}).description('The id map query retrieves the id map from the normalized AST.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'id-map'>;
