import type { LintingResult, LintingRule } from '../linter-format';
import { LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty  } from '../linter-format';
import { FileRole } from '../../project/context/flowr-file';
import { LintingRuleTag } from '../linter-tags';
import type { MergeableRecord } from '../../util/objects';
import { FlowrAnalyzerBuilder } from '../../project/flowr-analyzer-builder';
import type { QueryResults } from '../../queries/query';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { requestFromInput } from '../../r-bridge/retriever';

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
		if(!config.allowEmptyFiles) {
			startupFiles = startupFiles.filter(f => f.content().toString().trim().length > 0);
		}
		const ret: { results: AutoloadResult[], '.meta': MergeableRecord } = { results: [], '.meta': {} };
		if(startupFiles.length <= 0) {
			return ret;
		}

		// "top-level" startup files
		for(const file of startupFiles) {
			ret.results.push({
				certainty:  LintingResultCertainty.Certain,
				filePath:   file.path(),
				involvedId: undefined,
				loc:        undefined
			});
		}

		// use dependency query to find files that are sourced by our top-level startup files (and recursively)
		let deps: QueryResults<'dependencies'>;
		let df: DataflowGraph;
		// TODO die fake files hier weiterleiten
		const analyzer = await new FlowrAnalyzerBuilder().setConfig(ctx.config).build();
		try {
			for(const file of startupFiles) {
				// TODO hier kann man auch ein virtual/inline file angeben, dann gibt es die existenz probleme nicht
				analyzer.addRequest(requestFromInput(`file://${file.path()}`));
			}
			deps = await analyzer.query([{ type: 'dependencies', enabledCategories: ['source'] }]);
			df = (await analyzer.dataflow()).graph;
		} finally {
			analyzer.close();
		}
		console.log(deps);

		for(const sourced of deps.dependencies.source) {
			console.log(sourced);
			if(sourced.value === undefined || sourced.nodeId === undefined) {
				continue;
			}
			console.log(sourced.value);
			const node = df.idMap?.get(sourced.nodeId);
			if(node === undefined) {
				continue;
			}
			console.log(node);
		}

		return ret;

		/*const wdRootsFor = WorkingDirectory.rootsResolver(, (await data.controlflow()).graph, ctx);
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
				const withWd = { ...ctx.config.solver.resolveSource, searchPath: [...(ctx.config.solver.resolveSource?.searchPath ?? []), ...wdRoots.roots] };
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
		}*/
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
