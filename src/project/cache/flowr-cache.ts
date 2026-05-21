import { assertUnreachable } from '../../util/assert';
import type { StringableContent } from '../context/flowr-file';

/**
 * Invalidation events describe how the cached analyzer state became stale.
 *
 * The current codebase triggers these events in two main ways:
 * - {@link InvalidationEventType.Full}: emitted by explicit reset flows such as
 *   {@link FlowrAnalyzerContext#reset} or {@link FlowrAnalyzerCache#reset}. Use this
 *   when the whole project state should be treated as stale.
 * - {@link InvalidationEventType.SingleFileInvalidate}: emitted by
 *   {@link FlowrFile#invalidate}, including {@link FlowrInlineTextFile#updateInlineContent},
 *   when one known file changed.
 */
export const enum InvalidationEventType {
	Full = 'full',
	SingleFileInvalidate = 'single-file-invalidate',
}

/**
 * Invalidation event for a single file identified by {@link filePath}.
 *
 * {@link oldContent} contains the file content from immediately before the
 * change that triggered this event. In other words, it is the pre-change content
 * for this invalidation, not necessarily the content from the last completed
 * analysis run.
 */
export interface SingleFileInvalidationEvent<Content extends StringableContent = StringableContent> {
	readonly type:       InvalidationEventType.SingleFileInvalidate;
	readonly oldContent: Content | undefined;
	readonly filePath:   string;
}

export type InvalidationEvent<Content extends StringableContent = StringableContent> =
	{ type: InvalidationEventType.Full }
 |  SingleFileInvalidationEvent<Content>;


export type InvalidationEventHandler<Content extends StringableContent = StringableContent> = (event: InvalidationEvent<Content>) => void;

export interface InvalidationEventReceiver<Content extends StringableContent = StringableContent> {
	receive: InvalidationEventHandler<Content>
}

/**
 * Central class for caching analysis results in FlowR.
 */
export abstract class FlowrCache<Cache> implements InvalidationEventReceiver {
	private value:      Cache | undefined = undefined;
	private dependents: InvalidationEventReceiver[] = [];

	public registerDependent(dependent: InvalidationEventReceiver) {
		this.dependents.push(dependent);
	}
	public removeDependent(dependent: InvalidationEventReceiver) {
		this.dependents = this.dependents.filter(d => d !== dependent);
	}

	receive(event: InvalidationEvent): void {
		const type = event.type;
		/* we will update this as soon as we support incremental update patterns */
		switch(type) {
			case InvalidationEventType.Full:
			case InvalidationEventType.SingleFileInvalidate:
				this.value = undefined;
				break;
			default:
				assertUnreachable(type);
		}
		/* in the future we want to defer this *after* the dataflow is re-computed, then all receivers can decide whether they need to update */
		this.notifyDependents(event);
	}

	/**
	 * Notify all dependents of a cache invalidation event.
	 */
	public notifyDependents(event: InvalidationEvent) {
		for(const dependent of this.dependents) {
			dependent.receive(event);
		}
	}

	/**
	 * Get the cached value or compute it if not present.
	 * This will, by default, not trigger any {@link notifyDependents} calls, as this is only a cache retrieval.
	 */
	protected computeIfAbsent(force: boolean | undefined, compute: () => Cache): Cache {
		if(this.value === undefined || force) {
			this.value = compute();
		}
		return this.value;
	}

}
