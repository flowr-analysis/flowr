import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { AstIdMap } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeIdMapQuery } from './id-map-query-executor';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { summarizeIdsIfTooLong } from '../../../documentation/doc-util/doc-query';

export interface IdMapQuery extends BaseQueryFormat {
	readonly type: 'id-map';
}

export interface IdMapQueryResult extends BaseQueryResult {
	readonly idMap: AstIdMap;
}

export const IdMapQueryDefinition = {
	executor:        executeIdMapQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'id-map'>['id-map'];
		result.push(`Query: ${bold('id-map', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(`   ╰ Id List: {${summarizeIdsIfTooLong([...out.idMap.keys()])}}`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('id-map').required().description('The type of the query.'),
	}).description('The id map query retrieves the id map from the normalized AST.')
} as const satisfies SupportedQuery<'id-map'>;
