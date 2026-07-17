/**
 * Machine-readable renderings of linting results, for the tools that consume them (a CI, a code scanner, an editor).
 * @module
 */
import { type LintingRuleNames, LintingRules } from './linter-rules';
import {
	LintingPrettyPrintContext,
	LintingResultCertainty,
	LintingResults,
	type LintingResult
} from './linter-format';
import type { SourceLocation } from '../util/range';
import path from 'path';
import { FlowrGithubRef } from '../documentation/doc-util/doc-files';

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
	readonly rule:    LintingRuleNames
	readonly message: string
	readonly level:   Level
	readonly loc:     SourceLocation | undefined
}

/** flattened, as neither format groups by rule */
function findings(results: LintResultsByRule): Finding[] {
	return Object.entries(results).flatMap(([name, perRuleResults]): Finding[] => {
		const rule = name as LintingRuleNames;
		const perRule = perRuleResults as LintingResults<LintingRuleNames>;
		/* staying silent about a rule that threw would claim it passed */
		if(LintingResults.isError(perRule)) {
			const { error } = perRule;
			return [{
				rule,
				message: `the linting rule failed: ${error instanceof Error ? error.message : String(error)}`,
				level:   'error' as Level,
				loc:     undefined
			}];
		}
		return (perRule.results as readonly LintingResult[]).map(result => ({
			rule,
			message: LintingRules[rule].prettyPrint[LintingPrettyPrintContext.Query](result as never, perRule['.meta']),
			level:   (result.certainty === LintingResultCertainty.Certain ? 'warning' : 'note') as Level,
			loc:     result.loc
		}));
	});
}

/**
 * The path as a report has to name it: relative to the workspace, as neither a github annotation nor its sarif
 * ingestion attaches to an absolute one. A file outside of the workspace keeps its path, it has nothing to attach to.
 */
function reportedPath(file: string): string {
	const root = process.env.GITHUB_WORKSPACE ?? process.cwd();
	const relative = path.relative(root, file).replaceAll('\\', '/');
	return relative.length > 0 && !relative.startsWith('..') ? relative : file;
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
 * Renders the linting results as SARIF 2.1.0, the format code scanners (e.g. GitHub's) ingest, on a single line.
 * Only the rules that produced a finding are described, as SARIF requires every reported rule to be declared.
 */
export function lintsToSarif(results: LintResultsByRule, flowrVersion: string): string {
	const flat = findings(results);
	const reported = [...new Set(flat.map(f => f.rule))];
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
			results: flat.map(f => ({
				ruleId:    f.rule,
				level:     f.level,
				message:   { text: f.message },
				locations: sarifLocation(f.loc)
			}))
		}]
	});
}

/** GitHub has no 'note' */
const githubCommand: Record<Level, string> = { error: 'error', warning: 'warning', note: 'notice' };

/** `%`, `\r` and `\n` would end the workflow command */
function escapeGithubData(text: string): string {
	return text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

/** Renders the linting results as GitHub workflow commands, which a workflow run turns into annotations. */
export function lintsToGithub(results: LintResultsByRule): string {
	return findings(results).map(f => {
		const loc = f.loc !== undefined && f.loc[4] !== undefined ? f.loc : undefined;
		const where = loc === undefined ? '' : ` file=${escapeGithubData(reportedPath(loc[4] as string))},line=${loc[0]},col=${loc[1]},endLine=${loc[2]},endColumn=${loc[3]},`;
		return `::${githubCommand[f.level]}${where}${loc === undefined ? ' ' : ''}title=${escapeGithubData(f.rule)}::${escapeGithubData(f.message)}`;
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
	}
}
