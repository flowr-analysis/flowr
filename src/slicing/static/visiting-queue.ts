import type { Fingerprint } from './fingerprint';
import { fingerprint } from './fingerprint';
import type { NodeToSlice, SliceResult } from './slicer-types';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

export class VisitingQueue {
	private readonly threshold:   number;
	private timesHitThreshold:    number                   = 0;
	private readonly seen:        Map<Fingerprint, NodeId> = new Map();
	private readonly idThreshold: Map<NodeId, number>   = new Map();
	private readonly queue:       NodeToSlice[] = [];
	// the set of potential additions holds nodes which may be added if a second edge deems them relevant (e.g., found with the `defined-by-on-call` edge)
	// additionally it holds which node id added the addition so we can separate their inclusion on the structure
	public potentialAdditions:    Map<NodeId, [NodeId, NodeToSlice]> = new Map();

	constructor(threshold: number) {
		this.threshold = threshold;
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

	public status(): Readonly<Pick<SliceResult, 'timesHitThreshold' | 'result'>> {
		return {
			timesHitThreshold: this.timesHitThreshold,
			result:            new Set(this.seen.values())
		};
	}
}
