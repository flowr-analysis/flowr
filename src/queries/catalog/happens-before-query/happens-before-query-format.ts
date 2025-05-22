import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { executeHappensBefore } from './happens-before-query-executor';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { Ternary } from '../../../util/logic';

export interface HappensBeforeQuery extends BaseQueryFormat {
	readonly type: 'happens-before';
	readonly a:    SingleSlicingCriterion;
	readonly b:    SingleSlicingCriterion;
}

export interface HappensBeforeQueryResult extends BaseQueryResult {
	readonly results: Record<string, Ternary>;
}

export const HappensBeforeQueryDefinition = {
	executor:        executeHappensBefore,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'happens-before'>['happens-before'];
		result.push(`Query: ${bold('happens-before', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [key, value] of Object.entries(out.results)) {
			result.push(`   ╰ ${key}: ${value}`);
		}
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('happens-before').required().description('The type of the query.'),
		a:    Joi.string().required().description('The first slicing criterion.'),
		b:    Joi.string().required().description('The second slicing criterion.')
	}).description('Happens-Before tracks whether a always happens before b.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'happens-before'>;
