import type { ParseStepOutput } from '../../r-bridge/parser';
import type { Tree } from 'web-tree-sitter';
import type { ReparseAction } from '../incremental/incremental-parse/incremental-parse';

export interface ParseInfo {
	lastParseStepOutput: ParseStepOutput<Tree | string> | undefined;
	nextReparseAction:   ReparseAction | undefined;
}

export interface ReadOnlyFlowrAnalyzerIncrementalAnalysisContext {
	/**
	 * The name of this context.
	 */
	readonly name: string;

	getParseInfo(): ParseInfo | undefined;
}

/**
 * Information to carry over for future incremental builds
 */
export class FlowrAnalyzerIncrementalAnalysisContext implements ReadOnlyFlowrAnalyzerIncrementalAnalysisContext {
	public readonly name = 'flowr-analyzer-incremental-analysis-context';

	private parseInfo?: ParseInfo;

	public reset(): void {
		this.parseInfo = undefined;
	}

	public storeParseInfo(parseInfo?: ParseInfo): void {
		this.parseInfo = parseInfo;
	}

	public getParseInfo(): ParseInfo | undefined {
		return this.parseInfo;
	}
}
