import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';

import type { SingleSlicingCriterion, SlicingCriteria } from '../../../slicing/criterion/parse';
import type { QueryResults, SupportedQuery } from '../../query';
import Joi from 'joi';
import { executeSdeQuery } from './sde-query-executor';
import { Lift, Value } from '../../../abstract-interpretation/eval/domain';

interface SdeResult {
	readonly criterion: SingleSlicingCriterion,
	readonly determined: Lift<Value> | undefined,
}

export interface SdeQuery extends BaseQueryFormat {
	readonly type:     'sde';
	readonly criteria: SlicingCriteria,
}

export interface SdeQueryResult extends BaseQueryResult {
	results: Map<SingleSlicingCriterion, Lift<Value> | undefined>,
}

export const SdeQueryDefinition = {
	executor:        executeSdeQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'sde'>['sde'];
		result.push("=====SDE_START=====")
		for (const [criterion, determined] of out.results.entries()) {
			const sdeResult: SdeResult = {
				criterion,
				determined,
			};
			result.push(JSON.stringify(sdeResult))
		}
		result.push("=====SDE_STOP=====")
		return true;
	},
	schema: Joi.object({
		type:     Joi.string().valid('sde').required().description('The type of the query.'),
		criteria: Joi.array().items(Joi.string()).min(1).required().description('The slicing criteria to use.'),
	}).description('The resolve value query used to get definitions of an identifier'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'sde'>;
