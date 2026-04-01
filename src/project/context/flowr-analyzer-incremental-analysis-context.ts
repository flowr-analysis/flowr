import type Parser from 'web-tree-sitter';


export interface ReparseInfo {
	previousTree: string | Parser.Tree | undefined;
	editRegion:   Parser.Edit;
}

export interface ReadOnlyFlowrAnalyzerIncrementalAnalysisContext {
	/**
	 * The name of this context.
	 */
	readonly name: string;

	getAndRemoveParseInfo(filePath: string): ReparseInfo | undefined;
}

/**
 * Information to carry over for future incremental builds
 */
export class FlowrAnalyzerIncrementalAnalysisContext implements ReadOnlyFlowrAnalyzerIncrementalAnalysisContext {
	public readonly name = 'flowr-analyzer-incremental-analysis-context';

	private reparseInfoMap: Map<string, ReparseInfo> = new Map();

	public reset(): void {
		this.reparseInfoMap = new Map();
	}

	public storeReparseInfo(filePath: string, reparseInfo?: ReparseInfo): void {
		if(reparseInfo) {
			this.reparseInfoMap.set(filePath, reparseInfo);
		}
	}

	public getAndRemoveParseInfo(filePath: string): ReparseInfo | undefined {
		const reparseInfo = this.reparseInfoMap.get(filePath);
		this.reparseInfoMap.delete(filePath);
		return reparseInfo;
	}
}
