import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import { FileRole } from '../../project/context/flowr-file';
import { LintingRuleTag } from '../linter-tags';
import type { MergeableRecord } from '../../util/objects';

export interface AutoloadResult extends LintingResult {
	readonly filePath: string;
}

export interface AutoloadConfig extends MergeableRecord {
	readonly allowedFilePatterns: (string | RegExp)[]
}

export const AUTOLOAD_FILES = {
	createSearch:        () => undefined as never,
	processSearchResult: (_elements, config, data) => {
		const ctx = data.inspectContext();
		for(const file of ctx.files.getFilesByRole(FileRole.Startup)) {
			// TODO see if files have any content; if so, report them
			// TODO see if files source *further* files (-> dependencies query?) and report those as well (recursively!)
		}
		return { results, '.meta': {} };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result) => `File \`${result.filePath}\``,
		[LintingPrettyPrintContext.Full]:  (result) => `File \`${result.filePath}\` will be executed automatically when running scripts in this project; ensure that it contains no malicious code.`
	},
	info: {
		name:          'Autoload Files',
		description:   'Checks for code in a project that will be executed automatically through autoload files like .RProfile',
		tags:          [LintingRuleTag.Security],
		certainty:     LintingRuleCertainty.OverApproximative,
		defaultConfig: () => ({
			allowedFilePatterns: []
		})
	}
} as const satisfies LintingRule<AutoloadResult, MergeableRecord, AutoloadConfig, never, never>;
