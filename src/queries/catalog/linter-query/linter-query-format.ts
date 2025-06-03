import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { QueryResults, SupportedQuery } from '../../query';
import Joi from 'joi';
import { executeLinterQuery } from './linter-query-executor';
import type { LintingRuleNames, LintingRuleResult } from '../../../linter/linter-rules';
import { LintingRules } from '../../../linter/linter-rules';
import type { ConfiguredLintingRule, LintingResults } from '../../../linter/linter-format';
import { LintingPrettyPrintContext , LintingCertainty } from '../../../linter/linter-format';

import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import { codeInline } from '../../../documentation/doc-util/doc-code';

export interface LinterQuery extends BaseQueryFormat {
	readonly type:   'linter';
	/**
	 * The rules to lint for. If unset, all rules will be included.
	 * Optionally, a {@link ConfiguredLintingRule} can be provided, which additionally includes custom user-supplied values for the linting rules' configurations.
	 */
	readonly rules?: (LintingRuleNames | ConfiguredLintingRule)[];
}

export interface LinterQueryResult extends BaseQueryResult {
	/**
	 * The results of the linter query, which returns a set of linting results for each rule that was executed.
	 */
	readonly results: { [L in LintingRuleNames]?: LintingResults<L>}
}


export const LinterQueryDefinition = {
	executor:        executeLinterQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'linter'>['linter'];
		result.push(`Query: ${bold('linter', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [ruleName, results] of Object.entries(out.results)) {
			const rule = LintingRules[ruleName as LintingRuleNames];
			result.push(`   ╰ **${rule.humanReadableName}** (${ruleName}):`);
			for(const certainty of [LintingCertainty.Definitely, LintingCertainty.Maybe]) {
				const certaintyResults = results.results.filter(r => r.certainty === certainty);
				if(certaintyResults.length) {
					result.push(`       ╰ ${certainty}:`);
					for(const res of certaintyResults) {
						result.push(`           ╰ ${rule.prettyPrint[LintingPrettyPrintContext.Query](res as LintingRuleResult<LintingRuleNames>)}`);
					}
				}
			}
			result.push(`       ╰ _Metadata_: ${codeInline(JSON.stringify(results['.meta']))}`);
		}
		return true;
	},
	schema: Joi.object({
		type:  Joi.string().valid('linter').required().description('The type of the query.'),
		rules: Joi.array().items(
			Joi.string().valid(...Object.keys(LintingRules)),
			Joi.object({
				name:   Joi.string().valid(...Object.keys(LintingRules)).required(),
				config: Joi.object()
			})
		).description('The rules to lint for. If unset, all rules will be included.')
	}).description('The linter query lints for the given set of rules and returns the result.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'linter'>;
