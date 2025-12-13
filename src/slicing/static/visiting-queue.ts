import { type Fingerprint , fingerprint } from './fingerprint';
import type { NodeToSlice, SliceResult } from './slicer-types';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraphVertexInfo } from '../../dataflow/graph/vertex';

export class VisitingQueue {
	private readonly threshold:   number;
	private timesHitThreshold:    number                   = 0;
	private readonly seen:        Map<Fingerprint, NodeId> = new Map();
	private readonly seenByCache: Set<NodeId>              = new Set();
	private readonly idThreshold: Map<NodeId, number>      = new Map();
	private readonly queue:       NodeToSlice[] = [];
	private readonly cache?:      Map<Fingerprint, Set<NodeId>> = new Map();
	// the set of potential additions holds nodes which may be added if a second edge deems them relevant (e.g., found with the `defined-by-on-call` edge)
	// additionally it holds which node id added the addition so we can separate their inclusion on the structure
	public potentialAdditions:    Map<NodeId, [NodeId, NodeToSlice]> = new Map();
	private cachedCallTargets:    Map<NodeId, Set<DataflowGraphVertexInfo>> = new Map();

	constructor(threshold: number, cache?: Map<Fingerprint, Set<NodeId>>) {
		this.threshold = threshold;
		this.cache     = cache;
	}

	/**
	 * Adds a node to the queue if it has not been seen before.
	 * @param target             - the node to add
	 * @param env                - the environment the node is traversed in
	 * @param envFingerprint     - the fingerprint of the environment
	 * @param onlyForSideEffects - whether the node is only used for its side effects
	 */
	public add(target: NodeId, env: REnvironmentInformation, envFingerprint: string, onlyForSideEffects: boolean): void {
		const idCounter = this.idThreshold.get(target) ?? 0;
		if(idCounter > this.threshold) {
			this.timesHitThreshold++;
			return;
		}

		/* we do not include the in call part in the fingerprint as it is 'deterministic' from the source position */
		const print = fingerprint(target, envFingerprint, onlyForSideEffects);

		if(!this.seen.has(print)) {
			const cached = this.cache?.get(print);
			if(cached) {
				this.seenByCache.add(target);
				for(const id of cached) {
					this.queue.push({ id, baseEnvironment: env, envFingerprint, onlyForSideEffects });
				}
			}
			this.idThreshold.set(target, idCounter + 1);
			this.seen.set(print, target);
			this.queue.push({ id: target, baseEnvironment: env, envFingerprint, onlyForSideEffects });
		}
	}

	public next(): NodeToSlice {
		return this.queue.pop() as NodeToSlice;
	}

	public nonEmpty(): boolean {
		return this.queue.length > 0;
	}

	public hasId(id: NodeId): boolean {
		return this.idThreshold.has(id);
	}

	public memoizeCallTargets(id: NodeId, targets: () => Set<DataflowGraphVertexInfo>): Set<DataflowGraphVertexInfo> {
		if(!this.cachedCallTargets.has(id)) {
			this.cachedCallTargets.set(id, targets());
		}
		return this.cachedCallTargets.get(id) as Set<DataflowGraphVertexInfo>;
	}

	public status(): Readonly<Pick<SliceResult, 'timesHitThreshold' | 'result'>> {
		return {
			timesHitThreshold: this.timesHitThreshold,
			result:            new Set([...this.seen.values(), ...this.seenByCache])
		};
	}
}
