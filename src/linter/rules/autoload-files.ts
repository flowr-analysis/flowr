import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import type { FlowrFileProvider } from '../../project/context/flowr-file';
import { FileRole } from '../../project/context/flowr-file';
import { LintingRuleTag } from '../linter-tags';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

export interface AutoloadResult extends LintingResult {
	readonly filePath: string;
}

export interface AutoloadConfig extends MergeableRecord {
	readonly allowEmptyFiles:     boolean
	readonly allowInvalidFiles:   boolean
	readonly allowedFilePatterns: (string | RegExp)[]
}

export const AUTOLOAD_FILES = {
	createSearch:        () => Q.fromQuery([{ type: 'dependencies', enabledCategories: ['source'] }]),
	processSearchResult: (elements, config, data) => {
		const results: AutoloadResult[] = [];
		const patterns = config.allowedFilePatterns.map(p => typeof p == 'string' ? new RegExp(p) : p);
		const sourced = new Map(elements.enrichmentContent(Enrichment.QueryData).queries['dependencies'].source
			.filter(s => s.nodeId !== undefined).map(s => [s.nodeId as NodeId, s]));
		const files = data.inspectContext().files;
		for(const file of files.getFilesByRole(FileRole.Startup)) {
			analyzeFile(file);
		}
		return { results, '.meta': {} };

		function analyzeFile(file: FlowrFileProvider) {
			const path = file.path();
			if(patterns.some(p => p.exec(path))) {
				return;
			}
			const content = file.content().toString();
			if(config.allowEmptyFiles && content.trim().length <= 0) {
				return;
			}

			results.push({
				certainty:  LintingResultCertainty.Certain,
				filePath:   path,
				involvedId: undefined,
				loc:        undefined
			});

			// TODO this doesn't work yet because the dependency query doesn't include files that are just "added on" through addFile, it only looks at parse requests! -> how solve :(
			const sourcedInFile = elements.getElements().filter(e => e.node.info.file === path).map(e => sourced.get(e.node.info.id)?.value);
			console.log(path, elements.getElements().map(e => e.node.info.file), sourced, sourcedInFile);
			for(const sourced of sourcedInFile) {
				if(sourced !== undefined) {
					const otherFile = files.getFileByPath(sourced);
					if(otherFile !== undefined) {
						// TODO check if the file is already in our results list, otherwise we may go into an endless loop!
						analyzeFile(otherFile);
					} else if(!config.allowInvalidFiles) {
						results.push({
							certainty:  LintingResultCertainty.Uncertain,
							filePath:   sourced,
							involvedId: undefined,
							loc:        undefined
						});
					}
				}
			}
		}
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
			allowInvalidFiles:   false,
			allowedFilePatterns: []
		})
	}
} as const satisfies LintingRule<AutoloadResult, MergeableRecord, AutoloadConfig>;
