import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';

import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';

import { executeResolveValueQuery } from './origin-query-executor';
import type { Origin } from '../../../dataflow/origin/dfg-get-origin';


export interface OriginQuery extends BaseQueryFormat {
	readonly type:      'origin';
	/** The slicing criteria to use */
	readonly criterion: SingleSlicingCriterion,
}

export interface OriginQueryResult extends BaseQueryResult {
	results: Record<SingleSlicingCriterion, Origin[] | undefined>
}

export const OriginQueryDefinition = {
	executor:        executeResolveValueQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'origin'>['origin'];
		result.push(`Query: ${bold('origin', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [criteria, obj] of Object.entries(out.results)) {
			result.push(`   ╰ Origins for {${criteria}}`);
			result.push(`   	╰ ${obj?.map(o => JSON.stringify(o)).join(', ')}`);
		}
		return true;
	},
	schema: Joi.object({
		type:      Joi.string().valid('origin').required().description('The type of the query.'),
		criterion: Joi.string().required().description('The slicing criteria to use'),
	}).description('The resolve value query used to get definitions of an identifier')
} as const satisfies SupportedQuery<'origin'>;
