import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';

import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';

import { executeStringDomainQuery } from './string-domain-query-executor';
import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import { valueToString, type Lift, type Value } from '../../../abstract-interpretation/eval/domain';

/** Infer the shape of data frames using abstract interpretation. */
export interface StringDomainQuery extends BaseQueryFormat {
	readonly type:     'string-domain';
	/** The slicing criteria to use */
	readonly criteria: SlicingCriteria,
}

export interface StringDomainQueryResult extends BaseQueryResult {
	results: Record<string, {values: Lift<Value>[]}>,
}

export const StringDomainQueryDefinition = {
	executor:        executeStringDomainQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'string-domain'>['string-domain'];
		result.push(`Query: ${bold('string-domain', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [fingerprint, obj] of Object.entries(out.results)) {
			const { criteria } = JSON.parse(fingerprint) as StringDomainQuery;
			result.push(`   ╰ Values for {${criteria.join(', ')}}`);
			result.push(`   	╰ ${obj.values.map(it => valueToString(it)).join(', ')}`);
		}
		return true;
	},
	schema: Joi.object({
		type:     Joi.string().valid('string-domain').required().description('The type of the query.'),
		criteria: Joi.array().items(Joi.string()).min(1).required().description('The slicing criteria to use.'),
	}).description('The string domain query retrieves information on the possible string values of an expression'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'string-domain'>;
