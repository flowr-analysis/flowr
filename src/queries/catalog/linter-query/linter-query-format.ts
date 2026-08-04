import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import Joi from 'joi';
import { executeLinterQuery } from './linter-query-executor';
import {
	type LintingRuleConfig,
	type LintingRuleMetadata,
	type LintingRuleNames,
	type LintingRuleResult,
	LintingRules
} from '../../../linter/linter-rules';
import { type LintingResultsError,
	type ConfiguredLintingRule,
	LintingPrettyPrintContext,
	LintingResultCertainty,
	LintingResults,
	type LintingRule
} from '../../../linter/linter-format';
import { bold, italic, ColorEffect, Colors, FontStyles, type OutputFormatter } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import type { FlowrConfig } from '../../../config';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { CommandCompletions } from '../../../cli/repl/core';
import { fileProtocol } from '../../../r-bridge/retriever';
import { getGuardIssueUrl, isNotUndefined } from '../../../util/assert';
import fs from 'fs';
import { type LintResultsByRule, LinterOutputFormat } from '../../../linter/linter-output';

export interface LinterQuery extends BaseQueryFormat {
	readonly type:    'linter';
	/**
	 * The rules to lint for. If unset, all rules will be included.
	 * Optionally, a {@link ConfiguredLintingRule} can be provided, which additionally includes custom user-supplied values for the linting rules' configurations.
	 */
	readonly rules?:  (LintingRuleNames | ConfiguredLintingRule)[];
	/** Print the findings in a machine-readable {@link LinterOutputFormat|format} instead of the human-readable summary. */
	readonly format?: LinterOutputFormat;
}

export interface LinterQueryResult extends BaseQueryResult {
	/**
	 * The results of the linter query, which returns a set of linting results for each rule that was executed.
	 */
	readonly results:    LintResultsByRule
	/** The findings rendered in the requested {@link LinterQuery#format|format}, if one was requested. */
	readonly formatted?: string
}

function rulesFromInput(output: ReplOutput, rulesPart: readonly string[]): { valid: (LintingRuleNames | ConfiguredLintingRule)[], invalid: string[] } {
	return rulesPart
		.reduce((acc, ruleName) => {
			ruleName = ruleName.trim();
			if(ruleName in LintingRules) {
				acc.valid.push(ruleName as LintingRuleNames);
			} else {
				acc.invalid.push(ruleName);
			}
			return acc;
		}, { valid: [] as (LintingRuleNames | ConfiguredLintingRule)[], invalid: [] as string[] });
}

const rulesPrefix = 'rules:';
const formatPrefix = 'format:';

/** the {@link LinterOutputFormat} of a `format:` argument, warning about an unknown one instead of ignoring it */
function formatFromInput(output: ReplOutput, argument: string): LinterOutputFormat | undefined {
	const wanted = argument.slice(formatPrefix.length).trim();
	const format = Object.values(LinterOutputFormat).find(f => f === wanted);
	if(format === undefined) {
		output.stderr(`Invalid linting format ${bold(wanted, output.formatter)}, expected one of `
			+ Object.values(LinterOutputFormat).map(f => bold(f, output.formatter)).join(', '));
	}
	return format;
}

function linterQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'linter'> {
	let rules: (LintingRuleNames | ConfiguredLintingRule)[] | undefined = undefined;
	let format: LinterOutputFormat | undefined = undefined;
	const rest = [...line];
	while(rest.length > 0 && (rest[0].startsWith(rulesPrefix) || rest[0].startsWith(formatPrefix))) {
		const argument = rest.shift() as string;
		if(argument.startsWith(formatPrefix)) {
			format = formatFromInput(output, argument);
			continue;
		}
		const parseResult = rulesFromInput(output, argument.slice(rulesPrefix.length).split(','));
		if(parseResult.invalid.length > 0) {
			output.stderr(`Invalid linting rule name(s): ${parseResult.invalid.map(r => bold(r, output.formatter)).join(', ')}`
				+ `\nValid rule names are: ${Object.keys(LintingRules).map(r => bold(r, output.formatter)).join(', ')}`);
		}
		rules = parseResult.valid;
	}
	/* an absent format must not show up as a key, a query is compared by its fingerprint */
	return { query: [{ type: 'linter', rules, ...(format ? { format } : {}) }], rCode: rest.join(' ').trim() || undefined } ;
}

function linterQueryCompleter(line: readonly string[], startingNewArg: boolean, _config: FlowrConfig): CommandCompletions {
	const current = startingNewArg ? '' : line[line.length - 1] ?? '';

	if(current.startsWith(formatPrefix)) {
		const wanted = current.slice(formatPrefix.length);
		return { completions: Object.values(LinterOutputFormat).filter(f => f !== wanted), argumentPart: wanted };
	} else if(current.startsWith(rulesPrefix)) {
		const usedRules = current.slice(rulesPrefix.length).split(',').map(r => r.trim());
		const allRules = Object.keys(LintingRules);
		const unusedRules = allRules.filter(r => !usedRules.includes(r));
		const lastRule = usedRules[usedRules.length - 1];
		const lastRuleIsUnfinished = !allRules.includes(lastRule);

		if(lastRuleIsUnfinished) {
			// Return all rules that have not been added yet
			return { completions: unusedRules, argumentPart: lastRule };
		} else if(unusedRules.length > 0) {
			// Add a comma, if the current last rule is complete
			return { completions: [','], argumentPart: '' };
		} else {
			// All rules are used, complete with a space
			return { completions: [' '], argumentPart: '' };
		}
	}
	/* both are optional and may come in any order, so offer whatever is not given yet */
	const given = startingNewArg ? line : line.slice(0, -1);
	return { completions: [
		...given.some(a => a.startsWith(rulesPrefix)) ? [] : [rulesPrefix],
		...given.some(a => a.startsWith(formatPrefix)) ? [] : [formatPrefix],
		fileProtocol
	] };
}

export const LinterQueryDefinition = {
	title:           'Linter Query',
	executor:        executeLinterQuery,
	asciiSummarizer: (formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'linter'>['linter'];
		/* a machine-readable format is the whole output: a consumer must not have to strip a summary around it */
		if(out.formatted !== undefined) {
			result.push(out.formatted);
			return true;
		}
		result.push(`Query: ${bold('linter', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		const allDidFail = Object.values(out.results).every(LintingResults.isError);
		if(allDidFail) {
			result.push('All linting rules failed to execute.');
			const files = analyzer.inspectContext().files;
			if(files.loadingOrder.getUnorderedRequests().length === 0) {
				const missing = files.getRequestedRoots().filter(p => !fs.existsSync(p));
				if(missing.length > 0) {
					result.push(formatter.format(`Path does not exist: ${missing.map(p => `'${p}'`).join(', ')}`, { color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
					return true;
				}
				result.push(
					formatter.format('No requests to lint for were found in the analysis.', { color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold })
				);
				result.push(
					'If you consider this an error, please report a bug: ' + getGuardIssueUrl('analyzer found no requests to lint for')
				);
			} else if(Object.values(out.results).length === 1) {
				const fst = Object.values(out.results)[0] as LintingResultsError;
				result.push('Error: ' + LintingResults.stringifyError(fst));
				if(fst.error instanceof Error) {
					// print stack
					result.push('Stack Trace:\n' + fst.error.stack);
				}
			}
			result.push(
				'If you consider this an error that should be fixed, please report a bug: ' + getGuardIssueUrl('linting rule threw an error')
			);
			return true;
		}
		for(const [ruleName, results] of Object.entries(out.results)) {
			addLintingRuleResult(ruleName as LintingRuleNames, results as LintingResults<LintingRuleNames>, result, formatter);
		}
		return true;
	},
	completer: linterQueryCompleter,
	fromLine:  linterQueryLineParser,
	syntax:    '@linter [rules:<r1>,<r2>,...] [format:<fmt>] <code | file://path>',
	schema:    Joi.object({
		type:   Joi.string().valid('linter').required().description('The type of the query.'),
		format: Joi.string().valid(...Object.values(LinterOutputFormat)).optional().description('Print the findings in a machine-readable format instead of the human-readable summary.'),
		rules:  Joi.array().items(
			Joi.string().valid(...Object.keys(LintingRules)),
			Joi.object({
				name:   Joi.string().valid(...Object.keys(LintingRules)).required(),
				config: Joi.object()
			})
		).description('The rules to lint for. If unset, all rules will be included.'),
	}).description('The linter query lints for the given set of rules and returns the result.'),
	flattenInvolvedNodes: (queryResults, _queries, certainty) => {
		const out = queryResults as LinterQueryResult;
		return Object.values(out.results).flatMap(v => {
			if(LintingResults.isError(v)) {
				return [];
			}
			const rows = certainty !== undefined ? v.results.filter(r => r.certainty === certainty) : v.results;
			return rows.flatMap(r => r.involvedId);
		}).filter(isNotUndefined);
	}
} as const satisfies SupportedQuery<'linter'>;

/** cap on findings shown per certainty before collapsing to a `+N more` line; the full set is in `:query*` JSON */
const MaxFindingsShown = 10;

function addLintingRuleResult<Name extends LintingRuleNames>(ruleName: Name, results: LintingResults<Name>, result: string[], formatter: OutputFormatter) {
	const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleMetadata<Name>, LintingRuleConfig<Name>>;
	const header = `${bold(rule.info.name, formatter)} (${ruleName})`;

	if(LintingResults.isError(results)) {
		const error = LintingResults.stringifyError(results).includes('At least one request must be set') ? 'No requests to lint for were found in the analysis.' : 'Error during execution of rule: ' + LintingResults.stringifyError(results);
		result.push(`   ╰ ${header}:`);
		result.push(`       ╰ ${error}`);
		return;
	}

	// a rule with no findings collapses to a single line (no per-certainty block, no metadata)
	if(results.results.length === 0) {
		result.push(`   ╰ ${header}: ${italic('no findings', formatter)}`);
		return;
	}

	result.push(`   ╰ ${header}:`);
	for(const certainty of [LintingResultCertainty.Certain, LintingResultCertainty.Uncertain]) {
		const certaintyResults = results.results.filter(r => r.certainty === certainty) as LintingRuleResult<Name>[];
		if(certaintyResults.length) {
			result.push(`       ╰ ${certainty}:`);
			for(const res of certaintyResults.slice(0, MaxFindingsShown)) {
				const pretty = rule.prettyPrint[LintingPrettyPrintContext.Query](res, results['.meta']);
				result.push(`           ╰ ${hyperlinkLocations(pretty, formatter)}${res.quickFix ? ` (${res.quickFix.length} quick fix(es) available)` : ''}`);
			}
			if(certaintyResults.length > MaxFindingsShown) {
				result.push(`           ╰ ${italic(`… +${certaintyResults.length - MaxFindingsShown} more (:query* for the full JSON)`, formatter)}`);
			}
		}
	}
	result.push(`       ╰ ${italic('Metadata', formatter)}: ${renderMetaData(results['.meta'])}`);
}

/**
 * Matches an absolute file path (POSIX `/...` or Windows `X:\...`) with an extension, followed by `:` and a flowR
 * position `<line>(.<col>)?(-<endline>.<endcol>)?`. Used to turn linting finding locations into clickable links.
 */
const locationPattern = /((?:[A-Za-z]:\\|\/)[^\s:]*\.[A-Za-z]+):(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)/g;

/** Wrap every `path:loc` location in the given pretty string in a `file://path:line:col` hyperlink via the formatter. */
function hyperlinkLocations(pretty: string, formatter: OutputFormatter): string {
	return pretty.replace(locationPattern, (match, path: string, position: string) => {
		const [line, col] = position.split('-')[0].split('.');
		const url = `file://${path}:${line}${col ? `:${col}` : ''}`;
		return formatter.hyperlink(match, url, true);
	});
}

function renderMetaData(metadata: object): string {
	return Object.entries(metadata).map(([k, v]) => `${k}: ${renderMetaValue(v)}`).join(', ');
}

/** Render a metadata value; a nested object (e.g. suppression counts) becomes `(key=value, ...)`, omitting zero counts (`0` if all zero). */
function renderMetaValue(value: unknown): string {
	if(value !== null && typeof value === 'object' && !Array.isArray(value)) {
		const nonZero = Object.entries(value).filter(([, v]) => v !== 0);
		return nonZero.length === 0 ? '0' : `(${nonZero.map(([k, v]) => `${k}=${renderMetaValue(v)}`).join(', ')})`;
	}
	return JSON.stringify(value);
}
