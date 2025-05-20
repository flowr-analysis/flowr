import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';

import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';

import type { DataFrameStateDomain } from '../../../abstract-interpretation/data-frame/domain';
import { executeDfShapeQuery } from './df-shape-query-executor';
import { jsonReplacer } from '../../../util/json';

/** Performs abstract interpretation to retrieve the shape of data frames. */
export interface DfShapeQuery extends BaseQueryFormat {
	readonly type: 'df-shape';
}

export interface DfShapeQueryResult extends BaseQueryResult {
	domains: DataFrameStateDomain
}

export const DfShapeQueryDefinition = {
	executor:        executeDfShapeQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'df-shape'>['df-shape'];
		result.push(`Query: ${bold('df-shape', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(...out.domains.entries().take(20).map(([key, domain]) => {
			return `   ╰ ${key}: ${JSON.stringify(domain, jsonReplacer)}`;
		}));
		if(out.domains.size > 20) {
			result.push('   ╰ ... (see JSON)');
		}
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('df-shape').required().description('The type of the query.'),
	}).description('Retrieve information on the dataframe shapes')
} as const satisfies SupportedQuery<'df-shape'>;
