import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type Parser from 'web-tree-sitter';
import type { FilePath } from '../../context/flowr-file';
import { computeEditRegion } from './edit-computation';


export interface ReparseInfo {
	readonly previousTree: Parser.Tree;
	readonly editRegion:   Parser.Edit | undefined;
}


/**
 * Computes the information needed to reparse a file incrementally with tree-sitter.
 * Returns `undefined` if incremental reparsing is not possible.
 */
export function computeReparseInfo(ctx: FlowrAnalyzerContext, filePath: FilePath): ReparseInfo | undefined {
	const previousTree = ctx.inc.getOldParseResultOf(filePath);
	if(!previousTree) {
		// this file was not parsed before
		return undefined;
	}

	const oldContent = ctx.inc.getOldContentOf(filePath);
	if(oldContent === undefined) {
		// this file has not been invalidated since the last parse, no reparse needed
		return {
			previousTree,
			editRegion: undefined
		};
	}

	const newContent = ctx.files.resolveRequest({ request: 'file', content: filePath }).r.content;
	if(newContent === oldContent) {
		// this file was invalidated, but the content did not change, no reparse needed
		return {
			previousTree,
			editRegion: undefined
		};
	}

	const editRegion = computeEditRegion(oldContent, newContent);
	return {
		previousTree,
		editRegion
	};
}