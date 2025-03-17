import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';
import { executeLinterQuery } from './linter-query-executor';
import type { LintingRuleNames, LintingRuleResult } from '../../../linter/linter-rules';
import { LintingRules } from '../../../linter/linter-rules';
import { LintingCertainty } from '../../../linter/linter-format';

export interface LinterQuery extends BaseQueryFormat {
	readonly type:   'linter';
	/**
	 * The rules to lint for. If unset, all rules will be included.
	 */
	readonly rules?: LintingRuleNames[];
}

export interface LinterQueryResult extends BaseQueryResult {
	readonly results: { [L in LintingRuleNames]?: LintingRuleResult<L>[] }
}

export const LinterQueryDefinition = {
	executor:        executeLinterQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'linter'>['linter'];
		result.push(`Query: ${bold('linter', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [ruleName, results] of Object.entries(out.results)) {
			const rule = LintingRules[ruleName as LintingRuleNames];
			result.push(`   ╰ ${ruleName}:`);
			for(const certainty of [LintingCertainty.Definitely, LintingCertainty.Maybe]) {
				const certaintyResults = results.filter(r => r.certainty === certainty);
				if(certaintyResults.length) {
					result.push(`       ╰ ${certainty}:`);
					for(const res of certaintyResults) {
						result.push(`           ╰ ${rule.prettyPrint(res)}`);
					}
				}
			}
		}
		return true;
	},
	schema: Joi.object({
		type:  Joi.string().valid('linter').required().description('The type of the query.'),
		rules: Joi.array().items(Joi.string().valid(...Object.keys(LintingRules))).optional().description('The rules to lint for. If unset, all rules will be included.')
	}).description('The linter query lints for the given set of rules and returns the result.')
} as const satisfies SupportedQuery<'linter'>;
