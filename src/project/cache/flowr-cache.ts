import { assertUnreachable } from '../../util/assert';

export const enum CacheInvalidationEventType {
    Full = 'full'
}
export type CacheInvalidationEvent =
    { type: CacheInvalidationEventType.Full }

export interface CacheInvalidationEventReceiver {
    receive(event: CacheInvalidationEvent): void
}

/**
 * Central class for caching analysis results in FlowR.
 */
export abstract class FlowrCache<Cache> implements CacheInvalidationEventReceiver {
	private value:      Cache | undefined = undefined;
	private dependents: CacheInvalidationEventReceiver[] = [];

	public registerDependent(dependent: CacheInvalidationEventReceiver) {
		this.dependents.push(dependent);
	}
	public removeDependent(dependent: CacheInvalidationEventReceiver) {
		this.dependents = this.dependents.filter(d => d !== dependent);
	}

	receive(event: CacheInvalidationEvent): void {
		/* we will update this as soon as we support incremental update patterns */
		switch(event.type) {
			case CacheInvalidationEventType.Full:
				this.value = undefined;
				break;
			default:
				assertUnreachable(event.type);
		}
		/* in the future we want to defer this *after* the dataflow is re-computed, then all receivers can decide whether they need to update */
		this.notifyDependents(event);
	}

	/**
     * Notify all dependents of a cache invalidation event.
     */
	public notifyDependents(event: CacheInvalidationEvent) {
		for(const dependent of this.dependents) {
			dependent.receive(event);
		}
	}

	/**
     * Get the cached value or compute it if not present.
     * This will, by default, not trigger any {@link notifyDependents} calls, as this is only a cache retrieval.
     */
	public computeIfAbsent(force: boolean | undefined, compute: () => Cache): Cache {
		if(this.value === undefined || force) {
			this.value = compute();
		}
		return this.value;
	}

}