import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { executeHappensBefore } from './happens-before-query-executor';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { Ternary } from '../../../util/logic';

export interface HappensBeforeQuery extends BaseQueryFormat {
	readonly type: 'happens-before';
	readonly a:    SlicingCriterion;
	readonly b:    SlicingCriterion;
}

export interface HappensBeforeQueryResult extends BaseQueryResult {
	readonly results: Record<string, Ternary>;
}

/**
 * How an answer of the {@link HappensBeforeQuery} is keyed: the two criteria it was asked about, so that both
 * the executor writing an answer and anyone reading one spell the key the same way.
 */
export const HappensBeforeKey = {
	name: 'HappensBeforeKey',
	/** The key the answer for `a` and `b` is stored under. */
	of(this: void, a: SlicingCriterion, b: SlicingCriterion): string {
		return `${a}<${b}`;
	},
	/** The two criteria a key was built from. */
	criteria(this: void, key: string): { a: string, b: string } {
		const at = key.indexOf('<');
		return at < 0 ? { a: key, b: '' } : { a: key.slice(0, at), b: key.slice(at + 1) };
	}
} as const;

export const HappensBeforeQueryDefinition = {
	title:           'Happens-Before Query',
	executor:        executeHappensBefore,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'happens-before'>['happens-before'];
		result.push(`Query: ${bold('happens-before', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [fingerprint, value] of Object.entries(out.results)) {
			const { a, b } = HappensBeforeKey.criteria(fingerprint);
			result.push(`   ╰ ${bold(a, formatter)} happens before ${bold(b, formatter)}: ${value}`);
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
