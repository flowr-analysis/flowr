import { assertUnreachable } from '../../util/assert';
import type { FlowrFileProvider, StringableContent } from '../context/flowr-file';

export const enum InvalidationEventType {
	Full = 'full',
	FileInvalidate = 'file-invalidate',
}

export interface FileContentInvalidateEvent<Content extends StringableContent = StringableContent> {
	readonly type:       InvalidationEventType.FileInvalidate;
	readonly oldContent: Content | undefined;
	readonly file:       FlowrFileProvider<Content>;
}

export type InvalidationEvent<Content extends StringableContent = StringableContent> =
	{ type: InvalidationEventType.Full }
 |  FileContentInvalidateEvent<Content>;


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
			case InvalidationEventType.FileInvalidate:
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