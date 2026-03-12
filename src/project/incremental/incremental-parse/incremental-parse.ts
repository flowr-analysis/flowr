import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { InvalidationEvent } from '../../cache/flowr-cache';
import { InvalidationEventType } from '../../cache/flowr-cache';
import type { FlowrFileProvider } from '../../context/flowr-file';

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

interface LineRange {
	line: number;
}
export interface ReparseAction {
	file:  FlowrFileProvider,
	range: 'full' | LineRange[];
}

/**
 *
 */
export function shouldWeReparse(ctx: FlowrAnalyzerContext, event: InvalidationEvent): 'full' | ReparseAction[] {
	if(event?.type === InvalidationEventType.Full) {
		return 'full';
	}

	const changedLines: LineRange[] = [];
	const oldContent = (event.oldContent?.toString() ?? '').split('\n');
	const newContent = (event.file.content().toString()).split('\n');
	for(let line = 0; line < Math.max(oldContent.length, newContent.length); line++) {
		if(oldContent[line] !== newContent[line]) {
			changedLines.push({ line });
		}
	}
	return [{
		file:  event.file,
		range: changedLines
	}];
}