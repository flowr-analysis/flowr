import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import type { FlowrFileProvider } from '../../project/context/flowr-file';
import { FileRole } from '../../project/context/flowr-file';
import { LintingRuleTag } from '../linter-tags';
import type { MergeableRecord } from '../../util/objects';
import { FlowrAnalyzerBuilder } from '../../project/flowr-analyzer-builder';
import { findSource } from '../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { isNotUndefined } from '../../util/assert';
import type { QueryResults } from '../../queries/query';
import { WorkingDirectory } from '../../dataflow/eval/resolve/resolve-working-directory';
import type { FlowrLaxSourcingOptions } from '../../config';
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
	createSearch:        () => undefined as never,
	processSearchResult: async(_elements, config, data) => {
		const results: AutoloadResult[] = [];
		const patterns = config.allowedFilePatterns.map(p => typeof p == 'string' ? new RegExp(p) : p);
		const ctx = data.inspectContext();
		const wdRootsFor = WorkingDirectory.rootsResolver((await data.dataflow()).graph, (await data.controlflow()).graph, ctx);
		for(const file of ctx.files.getFilesByRole(FileRole.Startup)) {
			await analyzeFile(file, []);
		}
		return { results, '.meta': {} };

		async function analyzeFile(file: FlowrFileProvider, prevReferences: string[]) {
			const path = file.path();
			if(patterns.some(p => p.exec(path)) || results.some(r => r.filePath === path)) {
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

			let deps: QueryResults<'dependencies'>;
			const analyzer = await new FlowrAnalyzerBuilder().setConfig(ctx.config).build();
			try {
				analyzer.addRequest(content);
				deps = await analyzer.query([{ type: 'dependencies', enabledCategories: ['source'] }]);
			} finally {
				analyzer.close();
			}
			const referenceChain = prevReferences.concat(path);
			for(const sourced of deps.dependencies.source) {
				if(sourced.value === undefined) {
					continue;
				}
				const wdRoots = wdRootsFor(sourced.nodeId as NodeId, path);
				const withWd = { ...ctx.config.solver.resolveSource, searchPath: [...(ctx.config.solver.resolveSource?.searchPath ?? []), ...wdRoots] };
				const sources = findSource(withWd as FlowrLaxSourcingOptions, sourced.value, { ctx, referenceChain });
				const sourcedFiles = sources?.map(p => ctx.files.getFileByPath(p)).filter(isNotUndefined);
				if(!sourcedFiles?.length) {
					if(!config.allowInvalidFiles) {
						results.push({
							certainty:  LintingResultCertainty.Uncertain,
							filePath:   sourced.value,
							involvedId: undefined,
							loc:        undefined
						});
					}
					continue;
				}
				for(const sourcedFile of sourcedFiles) {
					await analyzeFile(sourcedFile, referenceChain);
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
} as const satisfies LintingRule<AutoloadResult, MergeableRecord, AutoloadConfig, never, never>;
