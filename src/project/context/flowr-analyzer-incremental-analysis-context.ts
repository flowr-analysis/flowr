import type Parser from 'web-tree-sitter';
import type { InvalidationEvent, InvalidationEventReceiver } from '../cache/flowr-cache';
import { InvalidationEventType } from '../cache/flowr-cache';
import { assertUnreachable } from '../../util/assert';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import type { FilePath } from './flowr-file';
import type { ParseStepOutput } from '../../r-bridge/parser';
import fs from 'fs';


export interface ReadOnlyFlowrAnalyzerIncrementalAnalysisContext {
	/**
	 * The name of this context.
	 */
	readonly name: string;

	getOldParseResultOf(filePath: FilePath): Parser.Tree | undefined;
	getOldContentOf(filePath: FilePath): string | undefined;
}

type ShouldReparseTest = (filePath: FilePath, ctx: FlowrAnalyzerContext) => boolean;

/**
 * Information to carry over for future incremental builds
 */
export class FlowrAnalyzerIncrementalAnalysisContext implements ReadOnlyFlowrAnalyzerIncrementalAnalysisContext, InvalidationEventReceiver {
	public readonly name = 'flowr-analyzer-incremental-analysis-context';

	private readonly context:           FlowrAnalyzerContext;
	/**
	 * The files that have been changed since the last analysis mapping to their old content.
	 */
	private changedFilesWithOldContent: Map<FilePath, string | undefined> = new Map();
	private oldParseResults:            Map<FilePath, Parser.Tree> = new Map();
	private readonly lastKnownMtime:    Map<FilePath, number> = new Map();


	constructor(context: FlowrAnalyzerContext) {
		this.context = context;
	}

	public reset(): void {
		this.changedFilesWithOldContent = new Map();
		this.oldParseResults = new Map();
	}

	handleFileInvalidate(filePath: FilePath, oldContent: string | undefined): void {
		if(this.changedFilesWithOldContent.has(filePath)) {
			// If a file is changed multiple times since the last analysis, we only want to store the original old content as the old analysis results were computed with that.
			return;
		}

		this.changedFilesWithOldContent.set(filePath, oldContent);
	}

	handleShouldReparse(filePath: FilePath, ctx: FlowrAnalyzerContext): boolean {
		const heuristics = ctx.config.incrementalParsing;
		if(!heuristics) {
			return false;
		}

		if(heuristics.alwaysWithEdits) {
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
				ctx.inc.setLastKnownMtime(filePath, currentMtime);

				return !(lastMtime !== undefined && lastMtime === currentMtime);
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
