import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';

import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';

import { executeStringDomainQuery } from './string-domain-query-executor';
import { jsonReplacer } from '../../../util/json';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { SDValue } from '../../../abstract-interpretation/eval/domain';

/** Infer the shape of data frames using abstract interpretation. */
export interface StringDomainQuery extends BaseQueryFormat {
	readonly type:      'string-domain';
	readonly criterion: SingleSlicingCriterion;
}

export interface StringDomainQueryResult extends BaseQueryResult {
	stringDomainValues: Map<SingleSlicingCriterion, SDValue | undefined>,
}

export const StringDomainQueryDefinition = {
	executor:        executeStringDomainQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'string-domain'>['string-domain'];
		result.push(`Query: ${bold('string-domain', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(...out.stringDomainValues.entries().map(([key, value]) => {
			return `  -> ${key}: ${JSON.stringify(value, jsonReplacer)}`;
		}));
		return true;
	},
	schema: Joi.object({
		type:      Joi.string().valid('string-domain').required().description('The type of the query.'),
		criterion: Joi.string().required().description('The slicing criterion of the node to get the string domain for.')
	}).description('The string domain query retrieves information on the possible string values of an expression'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'string-domain'>;
