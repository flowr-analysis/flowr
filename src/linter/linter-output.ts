/**
 * Machine-readable renderings of linting results, for the tools that consume them (a CI, a code scanner, an editor).
 * @module
 */
import { type LintingRuleNames, LintingRules } from './linter-rules';
import {
	LintingPrettyPrintContext,
	LintingResultCertainty,
	LintingResults,
	type LintingResult,
	LintQuickFix
} from './linter-format';
import { SourceLocation } from '../util/range';
import { relativeTo } from '../util/files';
import { FlowrGithubRef } from '../documentation/doc-util/doc-files';
import { assertUnreachable } from '../util/assert';
import { uniqueArray } from '../util/collections/arrays';

/** The linting results of every rule that ran, i.e. what a linter query returns. */
export type LintResultsByRule = { [L in LintingRuleNames]?: LintingResults<L> };

/** The formats linting results are reported in. */
export enum LinterOutputFormat {
	/** flowR's own summary, made to be read by a human. The default, and the one {@link formatLints} leaves to flowR. */
	Text   = 'text',
	/** [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html), e.g. to upload to GitHub code scanning */
	Sarif  = 'sarif',
	/** [GitHub workflow commands](https://docs.github.com/actions/reference/workflow-commands-for-github-actions), one annotation per finding */
	Github = 'github'
}

/** named after the SARIF levels */
type Level = 'error' | 'warning' | 'note';

interface Finding {
	readonly rule:     LintingRuleNames
	readonly message:  string
	readonly level:    Level
	readonly loc:      SourceLocation | undefined
	readonly quickFix: readonly LintQuickFix[]
}

/** flattened, as neither format groups by rule */
function findings(results: LintResultsByRule): Finding[] {
	return Object.entries(results).flatMap(([name, perRuleResults]): Finding[] => {
		const rule = name as LintingRuleNames;
		const perRule = perRuleResults as LintingResults<LintingRuleNames>;
		/* staying silent about a rule that threw would claim it passed */
		if(LintingResults.isError(perRule)) {
			return [{ rule, message: `the linting rule failed: ${LintingResults.stringifyError(perRule)}`, level: 'error', loc: undefined, quickFix: [] }];
		}
		return (perRule.results as readonly LintingResult[]).map(result => ({
			rule,
			message:  LintingRules[rule].prettyPrint[LintingPrettyPrintContext.Query](result as never, perRule['.meta']),
			level:    (result.certainty === LintingResultCertainty.Certain ? 'warning' : 'note'),
			loc:      result.loc,
			quickFix: result.quickFix ?? []
		}));
	});
}

/** Neither a github annotation nor its sarif ingestion attaches to an absolute path, so report it from the workspace. */
function reportedPath(file: string): string {
	return relativeTo(process.env.GITHUB_WORKSPACE ?? process.cwd(), file);
}

/** a finding flowR cannot locate carries no location, rather than a broken one */
function sarifLocation(loc: SourceLocation | undefined): object[] {
	if(loc === undefined || loc[4] === undefined) {
		return [];
	}
	return [{
		physicalLocation: {
			artifactLocation: { uri: reportedPath(loc[4]) },
			region:           { startLine: loc[0], startColumn: loc[1], endLine: loc[2], endColumn: loc[3] }
		}
	}];
}

/**
 * The quick fixes of one finding as SARIF `fixes`. A fix needs a file and a span to change, so the ones flowR cannot
 * place are left out rather than reported against no artifact or an invalid region.
 */
function sarifFixes(fixes: readonly LintQuickFix[]): object[] {
	return fixes.flatMap(fix => {
		const file = SourceLocation.getFile(fix.loc);
		if(file === undefined || !LintQuickFix.isPlaced(fix)) {
			return [];
		}
		const [startLine, startColumn, endLine, endColumn] = SourceLocation.getRange(fix.loc);
		return [{
			description:     { text: fix.description },
			artifactChanges: [{
				artifactLocation: { uri: reportedPath(file) },
				replacements:     [{
					deletedRegion:   { startLine, startColumn, endLine, endColumn },
					insertedContent: { text: LintQuickFix.inserted(fix) }
				}]
			}]
		}];
	});
}

/**
 * Renders the linting results as SARIF 2.1.0, the format code scanners (e.g. GitHub's) ingest, on a single line.
 * Only the rules that produced a finding are described, as SARIF requires every reported rule to be declared.
 */
function lintsToSarif(results: LintResultsByRule, flowrVersion: string): string {
	const flat = findings(results);
	const reported = uniqueArray(flat.map(f => f.rule));
	return JSON.stringify({
		$schema: 'https://json.schemastore.org/sarif-2.1.0.json',
		version: '2.1.0',
		runs:    [{
			tool: {
				driver: {
					name:           'flowR',
					informationUri: FlowrGithubRef,
					version:        flowrVersion,
					rules:          reported.map(name => ({
						id:               name,
						name:             LintingRules[name].info.name,
						shortDescription: { text: LintingRules[name].info.description },
						properties:       { tags: LintingRules[name].info.tags }
					}))
				}
			},
			results: flat.map(f => {
				const fixes = sarifFixes(f.quickFix);
				return {
					ruleId:    f.rule,
					level:     f.level,
					message:   { text: f.message },
					locations: sarifLocation(f.loc),
					...(fixes.length > 0 ? { fixes } : {})
				};
			})
		}]
	});
}

/** GitHub has no 'note' */
const githubCommand: Record<Level, string> = { error: 'error', warning: 'warning', note: 'notice' };

/** `%`, `\r`, and `\n` would end the workflow command */
function escapeGithubData(text: string): string {
	return text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

/** Renders the linting results as GitHub workflow commands, which a workflow run turns into annotations. */
function lintsToGithub(results: LintResultsByRule): string {
	return findings(results).map(f => {
		const loc = f.loc !== undefined && f.loc[4] !== undefined ? f.loc : undefined;
		const where = loc === undefined ? '' : ` file=${escapeGithubData(reportedPath(loc[4] as string))},line=${loc[0]},col=${loc[1]},endLine=${loc[2]},endColumn=${loc[3]},`;
		// github annotations carry no fix of their own, so the offer goes into the message
		const fixes = f.quickFix.length === 0 ? '' : ` [quick fix: ${f.quickFix.map(fix => fix.description).join('; ')}]`;
		return `::${githubCommand[f.level]}${where}${loc === undefined ? ' ' : ''}title=${escapeGithubData(f.rule)}::${escapeGithubData(f.message + fixes)}`;
	}).join('\n');
}

/**
 * Renders the linting results in the given {@link LinterOutputFormat|format}, `undefined` for
 * {@link LinterOutputFormat.Text|Text}: that one is flowR's own summary, which only flowR itself renders.
 */
export function formatLints(results: LintResultsByRule, format: LinterOutputFormat, flowrVersion: string): string | undefined {
	switch(format) {
		case LinterOutputFormat.Sarif:
			return lintsToSarif(results, flowrVersion);
		case LinterOutputFormat.Github:
			return lintsToGithub(results);
		case LinterOutputFormat.Text:
			return undefined;
		default:
			/* a format nobody taught this about would otherwise read as Text, i.e. as no output at all */
			assertUnreachable(format);
	}
}
