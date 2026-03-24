import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FileContentInvalidateEvent, InvalidationEvent } from '../../cache/flowr-cache';
import { InvalidationEventType } from '../../cache/flowr-cache';
import type { FlowrFileProvider } from '../../context/flowr-file';
import type Parser from 'web-tree-sitter';

/**
 * Is this file even relevant to us?
 */
export function coarseCheckWhetherToInvalidate(ctx: FlowrAnalyzerContext, event: InvalidationEvent): boolean {
	if(event?.type === InvalidationEventType.Full) {
		return true;
	}
	// const path = event.file.path();
	// if the file has not been considered by the analysis we do not have to continue
	// TODO: make sure this also works for descriptions/other meta files maybe we have to check for the role
	/*
	if(event.file.roles?.includes(FileRole.Source) && !ctx.files.consideredFilesList().includes(path)) {
		return false;
	}
	*/
	const newContent = event.file.content();
	if(event.oldContent === newContent) {
		// TODO: maybe we want to allow a 'force' flag?
		// nothing changed
		console.debug('File content did not change, skipping invalidation');
		return false;
	}

	return true;
}

export interface ReparseAction {
	file: FlowrFileProvider,
	edit: Parser.Edit;
}

/**
 * Compute the reparse action for the given file.
 * @param event - The invalidation event.
 * @returns The reparse action.
 */
export function computeReparseAction(event: FileContentInvalidateEvent): ReparseAction {
	const oldContent = event.oldContent?.toString() ?? '';
	const newContent = event.file.content().toString();

	const oldLen = oldContent.length;
	const newLen = newContent.length;

	// 1) Longest common prefix
	let startIndex = 0;
	while(
		startIndex < oldLen &&
		startIndex < newLen &&
		oldContent[startIndex] === newContent[startIndex]
	) {
		startIndex++;
	}

	// 2) Longest common suffix, without overlapping the prefix
	let oldSuffixIndex = oldLen;
	let newSuffixIndex = newLen;
	while(
		oldSuffixIndex > startIndex &&
		newSuffixIndex > startIndex &&
		oldContent[oldSuffixIndex - 1] === newContent[newSuffixIndex - 1]
	) {
		oldSuffixIndex--;
		newSuffixIndex--;
	}

	const oldEndIndex = oldSuffixIndex;
	const newEndIndex = newSuffixIndex;

	return {
		file: event.file,
		edit: {
			startIndex,
			oldEndIndex,
			newEndIndex,
			startPosition:  indexToPoint(oldContent, startIndex),
			oldEndPosition: indexToPoint(oldContent, oldEndIndex),
			newEndPosition: indexToPoint(newContent, newEndIndex),
		}
	};
}


function indexToPoint(text: string, index: number): Parser.Point {
	let row = 0;
	let column = 0;

	for(let i = 0; i < index; i++) {
		if(text[i] === '\n') {
			row++;
			column = 0;
		} else {
			column++;
		}
	}

	return { row, column };
}