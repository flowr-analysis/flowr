import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { InvalidationEvent } from '../../cache/flowr-cache';
import { InvalidationEventType } from '../../cache/flowr-cache';
import { FileRole } from '../../context/flowr-file';

/**
 * Is this file even relevant to us?
 */
export function coarseCheckWhetherToInvalidate(ctx: FlowrAnalyzerContext, event: InvalidationEvent): boolean {
	if(event?.type === InvalidationEventType.Full) {
		return true;
	}

	if(!event.file.roles?.includes(FileRole.Source) && !event.file.roles?.includes(FileRole.Description)) {
		return false;
	}

	if(!ctx.files.consideredFilesList().includes(event.file.path())) {
		return false;
	}

	return event.oldContent !== event.file.content();
}