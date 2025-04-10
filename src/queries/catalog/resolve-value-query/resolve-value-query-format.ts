import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';

import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';

import { executeResolveValueQuery } from './resolve-value-query-executor';
import type { RNumberValue, RStringValue } from '../../../r-bridge/lang-4.x/convert-values';


export interface ResolveValueQuery extends BaseQueryFormat {
	readonly type:     'resolve-value';
	/** The slicing criteria to use */
	readonly criteria: SlicingCriteria,
}

export interface ResolveValueQueryResult extends BaseQueryResult {
	results: Record<string, {values: unknown[]}>
}

function rValueToAscii(value: string | RNumberValue | RStringValue): string {
	if(value === null || value === undefined) {
		return 'undefined';
	} else if(typeof value === 'string') {
		return value;
	} else if(typeof value === 'object') {
		if('num' in value) {
			return value.num.toString();
		} else if('str' in value) {
			return `${value.quotes}${value.str}${value.quotes}`;
		} else {
			console.warn('omega lul');
			return JSON.stringify(value);
		}
	}

	return value;
}

export const ResolveValueQueryDefinition = {
	executor:        executeResolveValueQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'resolve-value'>['resolve-value'];
		result.push(`Query: ${bold('resolve-value', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [fingerprint, obj] of Object.entries(out.results)) {
			const { criteria } = JSON.parse(fingerprint) as ResolveValueQuery;
			result.push(`   ╰ Values for {${criteria.join(', ')}}`);
			result.push(`   	╰ ${obj.values.map(v => rValueToAscii(v as string | RNumberValue | RStringValue)).join(', ')}`);
		}
		return true;
	},
	schema: Joi.object({
		type:     Joi.string().valid('resolve-value').required().description('The type of the query.'),
		criteria: Joi.array().items(Joi.string()).min(1).required().description('The slicing criteria to use.'),
	}).description('The resolve value query used to get definitions of an identifier'),
	toSearchElements: () => []
} as const satisfies SupportedQuery<'resolve-value'>;
