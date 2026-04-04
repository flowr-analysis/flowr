import type Parser from 'web-tree-sitter';
import type { InvalidationEvent, InvalidationEventReceiver } from '../cache/flowr-cache';
import { InvalidationEventType } from '../cache/flowr-cache';
import { assertUnreachable } from '../../util/assert';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import type { FilePath } from './flowr-file';
import type { ParseStepOutput } from '../../r-bridge/parser';


export interface ReadOnlyFlowrAnalyzerIncrementalAnalysisContext {
	/**
	 * The name of this context.
	 */
	readonly name: string;
}


/**
 * Information to carry over for future incremental builds
 */
export class FlowrAnalyzerIncrementalAnalysisContext implements ReadOnlyFlowrAnalyzerIncrementalAnalysisContext, InvalidationEventReceiver {
	public readonly name = 'flowr-analyzer-incremental-analysis-context';

	private readonly context:           FlowrAnalyzerContext;
	/**
	 * The files that have been changed since the last analysis mapping to their old content.
	 */
	private changedFilesWithOldContent: Map<FilePath, string> = new Map();
	private oldParseResults:            Map<FilePath, Parser.Tree> = new Map();


	constructor(context: FlowrAnalyzerContext) {
		this.context = context;
	}

	public reset(): void {
		this.changedFilesWithOldContent = new Map();
		this.oldParseResults = new Map();
	}

	handleFileInvalidate(filePath: FilePath, oldContent: string): void {
		if(this.changedFilesWithOldContent.has(filePath)) {
			// If a file is changed multiple times since the last analysis, we only want to store the original old content as the old analysis results were computed with that.
			return;
		}

		this.changedFilesWithOldContent.set(filePath, oldContent);
	}

	receive(event: InvalidationEvent): void {
		const type = event.type;
		switch(type) {
			case InvalidationEventType.Full:
				this.reset();
				break;
			case InvalidationEventType.FileInvalidate:
				this.handleFileInvalidate(event.filePath, event.oldContent?.toString() ?? '');
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

	public getAndRemoveOldContentOf(filePath: FilePath): string | undefined {
		const oldContent = this.changedFilesWithOldContent.get(filePath);
		this.changedFilesWithOldContent.delete(filePath);
		return oldContent;
	}
}
