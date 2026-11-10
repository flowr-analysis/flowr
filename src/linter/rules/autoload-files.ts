import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import { FileRole } from '../../project/context/flowr-file';
import { LintingRuleTag } from '../linter-tags';
import type { MergeableRecord } from '../../util/objects';
import { FlowrAnalyzerBuilder } from '../../project/flowr-analyzer-builder';
import { requestFromInput } from '../../r-bridge/retriever';
import { dirname, isAbsolute, join, normalize } from 'path';

export interface AutoloadResult extends LintingResult {
	readonly filePath: string;
}

export interface AutoloadConfig extends MergeableRecord {
	readonly allowEmptyFiles:     boolean
	readonly allowInvalidFiles:   boolean
	readonly allowedFilePatterns: (string | RegExp)[]
}

export const AUTOLOAD_FILES = {
	createSearch:        () => undefined as never,
	processSearchResult: async(_elements, config, data) => {
		const ctx = data.inspectContext();
		const patterns = config.allowedFilePatterns.map(p => typeof p === 'string' ? new RegExp(p) : p);
		let startupFiles = ctx.files.getFilesByRole(FileRole.Startup).filter(f => !patterns.some(p => p.exec(f.path())));
		if(config.allowEmptyFiles) {
			// when allowing empty files, just ignore them in our search
			startupFiles = startupFiles.filter(f => f.content().toString().trim().length > 0);
		}
		const foundPaths = new Set<string>(); // for deduplicating results
		const ret: { results: AutoloadResult[], '.meta': MergeableRecord } = { results: [], '.meta': {} };
		if(startupFiles.length <= 0) {
			return ret;
		}

		// "top-level" startup files
		for(const file of startupFiles) {
			const path = file.path();
			if(!foundPaths.has(path)) {
				foundPaths.add(path);
				ret.results.push({
					certainty:  LintingResultCertainty.Certain,
					filePath:   path,
					involvedId: undefined,
					loc:        undefined
				});
			}
		}

		// use dependency query to find files that are sourced by our top-level startup files (and recursively)
		const analyzer = await new FlowrAnalyzerBuilder().setConfig(ctx.config).build();
		try {
			// add "original" files from the previous/main analyzer
			for(const file of ctx.files.getAllFiles()) {
				analyzer.addFile(file);
			}
			for(const file of startupFiles) {
				analyzer.addRequest(requestFromInput(`file://${file.path()}`));
			}
			const deps = await analyzer.query([{ type: 'dependencies', enabledCategories: ['source'] }]);
			const df = (await analyzer.dataflow()).graph;

			for(const sourced of deps.dependencies.source) {
				if(sourced.value === undefined || sourced.nodeId === undefined) {
					continue;
				}
				const node = df.idMap?.get(sourced.nodeId);
				if(node === undefined) {
					continue;
				}
				const path = isAbsolute(sourced.value) || node.info.file === undefined ? normalize(sourced.value) : join(dirname(node.info.file), sourced.value);
				const certainty = analyzer.inspectContext().files.hasFile(path) ? LintingResultCertainty.Certain : !config.allowInvalidFiles ? LintingResultCertainty.Uncertain : undefined;
				if(certainty !== undefined && !foundPaths.has(path)) {
					foundPaths.add(path);
					ret.results.push({
						certainty,
						filePath:   path,
						involvedId: undefined,
						loc:        undefined
					});
				}
			}
		} finally {
			analyzer.close();
		}

		return ret;
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result) => `File \`${result.filePath}\``,
		[LintingPrettyPrintContext.Full]:  (result) => `File \`${result.filePath}\` will be executed automatically when running scripts in this project; ensure that it contains no malicious code.`
	},
	info: {
		name:          'Autoload Files',
		description:   'Finds code in a project that will be executed automatically through autoload files like .RProfile',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Smell],
		certainty:     LintingRuleCertainty.OverApproximative,
		defaultConfig: () => ({
			allowEmptyFiles:     true,
			allowInvalidFiles:   false,
			allowedFilePatterns: []
		})
	}
} as const satisfies LintingRule<AutoloadResult, MergeableRecord, AutoloadConfig, never, never>;
