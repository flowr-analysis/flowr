import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import { queryHeader } from '../../query-print';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { metaSince } from '../../query-meta';
import { Ternary } from '../../../util/logic';
import { log } from '../../../util/log';
import { happensBefore } from '../../../control-flow/happens-before';
import { SlicingCriterion } from '../../../slicing/criterion/parse';

/**
 * Execute happens-before queries on the given analyzer.
 * This checks, whether for two given slicing criteria `a` and `b`, `a` happens before `b` in the control flow graph.
 */
export async function executeHappensBefore({ analyzer }: BasicQueryData, queries: readonly HappensBeforeQuery[]): Promise<HappensBeforeQueryResult> {
	const start = Date.now();
	const results: Record<string, Ternary> = {};
	const ast = await analyzer.normalize();
	const cfg = await analyzer.controlflow(undefined);
	for(const query of queries) {
		const { a, b } = query;
		const fingerprint = HappensBeforeKey.of(a, b);
		if(fingerprint in results) {
			log.warn('Duplicate happens-before query', query, 'ignoring');
		}

		try {
			const resolvedA = SlicingCriterion.parse(a, ast.idMap);
			const resolvedB = SlicingCriterion.parse(b, ast.idMap);

			results[fingerprint] = happensBefore(cfg.graph, resolvedA, resolvedB);
		} catch(e) {
			log.error('Error while executing happens-before query', query, e);
			results[fingerprint] = Ternary.Maybe;
		}
	}

	return {
		...metaSince(start),
		results
	};
}

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
 * @helper api
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
	perQueryResults: true,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'happens-before'>['happens-before'];
		result.push(queryHeader('happens-before', formatter, out['.meta'].timing));
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
	}).description('Happens-Before tracks whether a always happens before b.')
} as const satisfies SupportedQuery<'happens-before'>;
