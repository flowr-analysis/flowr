import type { ParseStepOutput } from '../../r-bridge/parser';
import type { Tree } from 'web-tree-sitter';
import type { ReparseAction } from '../incremental/incremental-parse/incremental-parse';

export interface ReadOnlyFlowrAnalyzerIncrementalAnalysisContext {
	/**
	 * The name of this context.
	 */
	readonly name: string;

	getParse(): ParseStepOutput<Tree | string> | undefined;
	getReparseActions(): readonly ReparseAction[] | undefined;
}

/**
 * Information to carry over for future incremental builds
 */
export class FlowrAnalyzerIncrementalAnalysisContext implements ReadOnlyFlowrAnalyzerIncrementalAnalysisContext {
	public readonly name = 'flowr-analyzer-incremental-analysis-context';

	private parseStepOutput: ParseStepOutput<Tree | string> | undefined;
	private reparseActions:  readonly ReparseAction[] | undefined;

	public reset(): void {
		this.parseStepOutput = undefined;
		this.reparseActions = undefined;
	}

	public storeParse(parse: ParseStepOutput<Tree | string> | undefined, reparseAction: readonly ReparseAction[] | undefined): void {
		this.parseStepOutput = parse;
		this.reparseActions = reparseAction;
	}

	public getParse(): ParseStepOutput<Tree | string> | undefined {
		return this.parseStepOutput;
	}

	public getReparseActions(): readonly ReparseAction[] | undefined {
		return this.reparseActions;
	}

}
