import type Parser from 'web-tree-sitter';
import { type InvalidationEvent, type InvalidationEventReceiver, InvalidationEventType } from '../cache/flowr-cache';
import { assertUnreachable, guard } from '../../util/assert';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import type { FilePath } from './flowr-file';
import type { ParseStepOutput } from '../../r-bridge/parser';
import fs from 'fs';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type AnalyzedFile, type IncrementalUpdateResult, FlowrAnalyzerIncrementalDataflowUpdateTypePlugin } from '../plugins/incremental/incremental-dataflow/flowr-analyzer-incremental-dataflow-update-type-plugin';
import type { DataflowSnapshot } from '../incremental/incremental-dataflow/incremental-dataflow';
import { type IncrementalDataflowPlan, FlowrAnalyzerIncrementalDataflowHeuristicPlugin } from '../plugins/incremental/incremental-dataflow/flowr-analyzer-incremental-dataflow-heuristic-plugin';


export interface ReadOnlyFlowrAnalyzerIncrementalAnalysisContext {
	/** The name of this context. */
	readonly name: string;

	getOldParseResultOf(filePath: FilePath): Parser.Tree | undefined;
	getOldContentOf(filePath: FilePath): string | undefined;
	/** How the last incremental dataflow analysis classified the change, and whether it reused anything for it. */
	getLastAppliedIncrementalUpdate(): IncrementalUpdateResult | undefined;
}

/**
 * Heuristic dimension used by {@link FlowrAnalyzerIncrementalAnalysisContext.handleShouldReparse} to decide
 * whether incremental parsing is worth attempting for a given `filePath`.
 *
 * It is not this function's job to respect the config in {@link FlowrConfig.incremental.parsing}:
 * {@link FlowrAnalyzerIncrementalAnalysisContext.handleShouldReparse} only ever constructs and pushes
 * a `ShouldReparseTest` for a heuristic that is actually configured/enabled, reading
 * any thresholds into the closure at construction time.
 */
type ShouldReparseTest = (filePath: FilePath, ctx: FlowrAnalyzerContext) => boolean;

/** Information to carry over for future incremental builds */
export class FlowrAnalyzerIncrementalAnalysisContext implements ReadOnlyFlowrAnalyzerIncrementalAnalysisContext, InvalidationEventReceiver {
	public readonly name = 'flowr-analyzer-incremental-analysis-context';

	/** The files that have been changed since the last analysis mapping to their old content. */
	private changedFilesWithOldContent:   Map<FilePath, string | undefined> = new Map();
	private oldParseResults:              Map<FilePath, Parser.Tree> = new Map();
	/** what the last dataflow analysis kept for the next one, a single snapshot whose size the checkpoint configuration bounds */
	private dataflowSnapshot:             DataflowSnapshot | undefined = undefined;
	private readonly lastKnownMtime:      Map<FilePath, number> = new Map();
	private lastAppliedIncrementalUpdate: IncrementalUpdateResult | undefined = undefined;
	private readonly updateTypePlugin:    FlowrAnalyzerIncrementalDataflowUpdateTypePlugin;
	private readonly heuristicPlugin:     FlowrAnalyzerIncrementalDataflowHeuristicPlugin;
	/** how many dataflow analyses this context planned, see {@link planDataflow} */
	private dataflowAnalyses = 0;

	constructor(updateTypePlugins: readonly FlowrAnalyzerIncrementalDataflowUpdateTypePlugin[] = [], heuristicPlugins: readonly FlowrAnalyzerIncrementalDataflowHeuristicPlugin[] = []) {
		guard(updateTypePlugins.length <= 1, () => `at most one incremental-dataflow-update-type plugin may be registered, got ${updateTypePlugins.length}`);
		guard(heuristicPlugins.length <= 1, () => `at most one incremental-dataflow-heuristic plugin may be registered, got ${heuristicPlugins.length}`);
		this.updateTypePlugin = updateTypePlugins[0] ?? FlowrAnalyzerIncrementalDataflowUpdateTypePlugin.defaultPlugin();
		this.heuristicPlugin = heuristicPlugins[0] ?? FlowrAnalyzerIncrementalDataflowHeuristicPlugin.defaultPlugin();
	}

	/** Plans how the next dataflow analysis builds on the one before, which its files differ from by `update`, using whichever {@link FlowrAnalyzerIncrementalDataflowHeuristicPlugin} is active. */
	public planDataflow(ctx: FlowrAnalyzerContext, update: IncrementalUpdateResult | undefined): IncrementalDataflowPlan {
		const plan = this.heuristicPlugin.processor(ctx, { analyses: this.dataflowAnalyses, lastUpdate: this.lastAppliedIncrementalUpdate, update });
		this.dataflowAnalyses++;
		return plan;
	}

	public reset(): void {
		this.changedFilesWithOldContent = new Map();
		this.oldParseResults = new Map();
		this.dataflowSnapshot = undefined;
		this.lastAppliedIncrementalUpdate = undefined;
	}

	public fork(source: FlowrAnalyzerIncrementalAnalysisContext): void {
		for(const [path, content] of source.changedFilesWithOldContent) {
			this.changedFilesWithOldContent.set(path, content);
		}
		for(const [path, tree] of source.oldParseResults) {
			this.oldParseResults.set(path, tree);
		}
		for(const [path, mtime] of source.lastKnownMtime) {
			this.lastKnownMtime.set(path, mtime);
		}
		/* the dataflow snapshot is continued in place, so a fork starts its dataflow analysis from scratch */
	}

	handleFileInvalidate(filePath: FilePath, oldContent: string | undefined): void {
		if(this.changedFilesWithOldContent.has(filePath)) {
			// If a file is changed multiple times since the last analysis, we only want to store the original old content as the old analysis results were computed with that.
			return;
		}

		this.changedFilesWithOldContent.set(filePath, oldContent);
	}

	handleShouldReparse(filePath: FilePath, ctx: FlowrAnalyzerContext): boolean {
		if(ctx.config.incremental.alwaysIncremental) {
			return true;
		}
		if(!ctx.config.incremental.parsing.activated) {
			return false;
		}
		const heuristics = ctx.config.incremental.parsing.heuristics;
		if(!heuristics.activated || heuristics.alwaysWithEdits) {
			return true;
		}

		const checks: ShouldReparseTest[] = [];

		if(heuristics.mtime) {
			checks.push((filePath, ctx) => {
				let currentMtime: number | undefined;
				try {
					currentMtime = fs.statSync(filePath).mtimeMs;
				} catch{
					return true;
				}
				const lastMtime = ctx.inc.getLastKnownMtime(filePath);

				const mtimeChanged = !(lastMtime !== undefined && lastMtime === currentMtime);

				if(mtimeChanged) {
					ctx.inc.setLastKnownMtime(filePath, currentMtime);
				}

				return mtimeChanged;
			});
		}

		if(heuristics.linesFrom !== undefined) {
			checks.push((filePath, ctx) => {
				const content = ctx.files.getFileByPath(filePath)?.content();
				if(typeof content !== 'string') {
					return false;
				}
				const lineCount = content.split('\n').length;
				return lineCount >= heuristics.linesFrom;
			});
		}

		if(heuristics.bytesFrom) {
			checks.push((filePath) => {
				try {
					return fs.statSync(filePath).size >= heuristics.bytesFrom;
				} catch{
					return true;
				}
			});
		}

		if(heuristics.minFiles !== undefined) {
			checks.push((_filePath, ctx) => {
				return ctx.files.getFileCount() >= heuristics.minFiles;
			});
		}

		return checks.length === 0
			? true
			: checks.every(check => check(filePath, ctx));
	}

	/** Classifies how the files of `current` differ from the `previous` ones, using whichever {@link FlowrAnalyzerIncrementalDataflowUpdateTypePlugin} is active. */
	determineUpdateTypes(previous: readonly AnalyzedFile[], current: NormalizedAst, ctx: FlowrAnalyzerContext): IncrementalUpdateResult {
		return this.updateTypePlugin.processor(ctx, { previous, current });
	}

	/** Hands out what the last dataflow analysis kept, which the caller continues in place. */
	public takeDataflowSnapshot(): DataflowSnapshot | undefined {
		const snapshot = this.dataflowSnapshot;
		this.dataflowSnapshot = undefined;
		return snapshot;
	}

	public storeDataflowSnapshot(snapshot: DataflowSnapshot): void {
		this.dataflowSnapshot = snapshot;
	}

	receive(event: InvalidationEvent): void {
		const type = event.type;
		switch(type) {
			case InvalidationEventType.Full:
				this.reset();
				break;
			case InvalidationEventType.SingleFileInvalidate:
				this.handleFileInvalidate(event.filePath, event.oldContent?.toString());
				break;
			default:
				assertUnreachable(type);
		}
	}

	public storeOldParseResults(parseStepOutput: ParseStepOutput<Parser.Tree>): void {
		for(const parsedStepSingleOutput of parseStepOutput.files) {
			if(parsedStepSingleOutput.filePath === undefined) {
				// there could be multiple files without a file path, making a distinction impossible
				continue;
			}

			this.oldParseResults.set(parsedStepSingleOutput.filePath, parsedStepSingleOutput.parsed);
		}
	}

	public getOldParseResultOf(filePath: FilePath): Parser.Tree | undefined {
		return this.oldParseResults.get(filePath);
	}

	public getOldContentOf(filePath: FilePath): string | undefined {
		return this.changedFilesWithOldContent.get(filePath);
	}

	public storeAppliedIncrementalUpdate(update: IncrementalUpdateResult): void {
		this.lastAppliedIncrementalUpdate = update;
	}

	public getLastAppliedIncrementalUpdate(): IncrementalUpdateResult | undefined {
		return this.lastAppliedIncrementalUpdate;
	}

	public deleteOldContentOf(filePath: FilePath): void {
		this.changedFilesWithOldContent.delete(filePath);
	}

	public getLastKnownMtime(filePath: FilePath): number | undefined {
		return this.lastKnownMtime.get(filePath);
	}

	public setLastKnownMtime(filePath: FilePath, mtimeMs: number): void {
		this.lastKnownMtime.set(filePath, mtimeMs);
	}
}
