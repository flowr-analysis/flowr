import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import Joi from 'joi';
import { executeLinterQuery } from './linter-query-executor';
import type {
	LintingRuleConfig,
	LintingRuleMetadata,
	LintingRuleNames,
	LintingRuleResult
} from '../../../linter/linter-rules';
import { LintingRules } from '../../../linter/linter-rules';
import type { ConfiguredLintingRule, LintingResults, LintingRule } from '../../../linter/linter-format';
import { isLintingResultsError, LintingPrettyPrintContext, LintingResultCertainty } from '../../../linter/linter-format';

import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import { codeInline } from '../../../documentation/doc-util/doc-code';
import type { FlowrConfigOptions } from '../../../config';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';

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

function rulesFromInput(output: ReplOutput, rulesPart: readonly string[]): {valid: (LintingRuleNames | ConfiguredLintingRule)[], invalid: string[]} {
	return rulesPart
		.map(r => r.trim())
		.reduce((acc, ruleName) => {
			if(ruleName in LintingRules) {
				acc.valid.push(ruleName as LintingRuleNames);
			} else {
				acc.invalid.push(ruleName);
			}
			return acc;
		}, { valid: [] as (LintingRuleNames | ConfiguredLintingRule)[], invalid: [] as string[] });
}

function linterQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine {
	const rulesPrefix = 'rules:';
	let rules: (LintingRuleNames | ConfiguredLintingRule)[] | undefined = undefined;
	let input: string | undefined = undefined;
	if(line.length > 0 && line[0].startsWith(rulesPrefix)) {
		const rulesPart = line[0].slice(rulesPrefix.length).split(',');
		const parseResult = rulesFromInput(output, rulesPart);
		if(parseResult.invalid.length > 0) {
			output.stdout(`Invalid linting rule name(s): ${parseResult.invalid.map(r => bold(r, output.formatter)).join(', ')}`
				+`\nValid rule names are: ${Object.keys(LintingRules).map(r => bold(r, output.formatter)).join(', ')}`);
		}
		rules = parseResult.valid;
		input = line[1];
	} else if(line.length > 0) {
		input = line[0];
	}
	return { query: [{ type: 'linter', rules: rules }], rCode: input } ;
}

export const LinterQueryDefinition = {
	executor:        executeLinterQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'linter'>['linter'];
		result.push(`Query: ${bold('linter', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [ruleName, results] of Object.entries(out.results)) {
			addLintingRuleResult(ruleName as LintingRuleNames, results as LintingResults<LintingRuleNames>, result);
		}
		return true;
	},
	fromLine: linterQueryLineParser,
	schema:   Joi.object({
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

function addLintingRuleResult<Name extends LintingRuleNames>(ruleName: Name, results: LintingResults<Name>, result: string[]) {
	const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleMetadata<Name>, LintingRuleConfig<Name>>;
	result.push(`   ╰ **${rule.info.name}** (${ruleName}):`);

	if(isLintingResultsError(results)) {
		result.push(`       ╰ Error during execution of Rule: ${results.error}`);
		return;
	}

	for(const certainty of [LintingResultCertainty.Certain, LintingResultCertainty.Uncertain]) {
		const certaintyResults = results.results.filter(r => r.certainty === certainty) as LintingRuleResult<Name>[];
		if(certaintyResults.length) {
			result.push(`       ╰ ${certainty}:`);
			for(const res of certaintyResults) {
				const pretty = rule.prettyPrint[LintingPrettyPrintContext.Query](res, results['.meta']);
				result.push(`           ╰ ${pretty}${res.quickFix ? ` (${res.quickFix.length} quick fix(es) available)` : ''}`);
			}
		}
	}
	result.push(`       ╰ _Metadata_: ${codeInline(JSON.stringify(results['.meta']))}`);
}
