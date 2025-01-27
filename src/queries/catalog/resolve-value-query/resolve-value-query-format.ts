import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';

import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';

import { executeResolveValueQuery } from './resolve-value-query-executor';


export interface ResolveValueQuery extends BaseQueryFormat {
	readonly type:     'resolve-value';
	/** The slicing criteria to use */
	readonly criteria: SlicingCriteria,
}

export interface ResolveValueQueryResult extends BaseQueryResult {
	results: Record<string, {values: unknown[]}>
}

export const ResolveValueQueryDefinition = {
	executor:        executeResolveValueQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'resolve-value'>['resolve-value'];
		result.push(`Query: ${bold('resolve-value', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [fingerprint, obj] of Object.entries(out.results)) {
			const { criteria } = JSON.parse(fingerprint) as ResolveValueQuery;
			result.push(`   ╰ Values for {${criteria.join(', ')}}`);
			result.push(`   	╰ ${obj.values.join(', ')}`);
		}
		return true;
	},
	schema: Joi.object({
		type:     Joi.string().valid('resolve-value').required().description('The type of the query.'),
		criteria: Joi.array().items(Joi.string()).min(0).required().description('The slicing criteria to use.'),
	}).description('Resolve Value query used to get definitions of an identifier')
} as const satisfies SupportedQuery<'resolve-value'>;
