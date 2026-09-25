import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import { FileRole } from '../../project/context/flowr-file';
import { LintingRuleTag } from '../linter-tags';
import type { MergeableRecord } from '../../util/objects';

export interface AutoloadResult extends LintingResult {
	readonly filePath: string;
}

export interface AutoloadConfig extends MergeableRecord {
	readonly allowEmptyFiles:     boolean
	readonly allowedFilePatterns: (string | RegExp)[]
}

export const AUTOLOAD_FILES = {
	createSearch:        () => undefined as never,
	processSearchResult: (_elements, config, data) => {
		const results: AutoloadResult[] = [];
		const ctx = data.inspectContext();
		const patterns = config.allowedFilePatterns.map(p => typeof p == 'string' ? new RegExp(p) : p);
		for(const file of ctx.files.getFilesByRole(FileRole.Startup)) {
			const path = file.path();
			if(patterns.some(p => p.exec(path))) {
				continue;
			}
			if(config.allowEmptyFiles && file.content().toString().trim().length <= 0) {
				continue;
			}
			results.push({
				certainty:  LintingResultCertainty.Certain,
				filePath:   path,
				involvedId: undefined,
				loc:        undefined
			});

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
			allowEmptyFiles:     true,
			allowedFilePatterns: []
		})
	}
} as const satisfies LintingRule<AutoloadResult, MergeableRecord, AutoloadConfig, never, never>;
