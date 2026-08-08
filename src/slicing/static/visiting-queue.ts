import { type Fingerprint, fingerprint } from './fingerprint';
import type { NodeToSlice, SliceResult } from './slicer-types';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraphVertexInfo } from '../../dataflow/graph/vertex';
import type { ReadOnlyFlowrAnalyzerGasContext } from '../../project/context/flowr-analyzer-gas-context';
import { GasFeatureKey, GasLevel, GasWikiRef } from '../../gas';
import { slicerLogger } from './static-slicer';

/** How many nodes the traversal visits between two {@link GasFeatureKey.Slicer|gas} checks. */
const GasCheckEvery = 512;

export class VisitingQueue {
	private readonly threshold:      number;
	private timesHitThreshold:       number                   = 0;
	private readonly seen:           Map<Fingerprint, NodeId> = new Map();
	private readonly seenByCache:    Set<NodeId>              = new Set();
	private readonly idThreshold:    Map<NodeId, number>      = new Map();
	private readonly queue:          NodeToSlice[] = [];
	private readonly cache?:         Map<Fingerprint, Set<NodeId>> = new Map();
	// the set of potential additions holds nodes which may be added if a second edge deems them relevant (e.g., found with the `defined-by-on-call` edge)
	// additionally it holds which node id added the addition so we can separate their inclusion on the structure
	public potentialAdditions:       Map<NodeId, [NodeId, NodeToSlice]> = new Map();
	private cachedCallTargets:       Map<NodeId, Set<DataflowGraphVertexInfo>> = new Map();
	/** whether the dataflow graph has a vertex for an id, i.e. whether the traversal could continue from it */
	private readonly isGraphVertex?: (id: NodeId) => boolean;
	private readonly gas?:           ReadOnlyFlowrAnalyzerGasContext;
	private stoppedEarly            = false;
	private untilGasCheck           = 0;

	constructor(threshold: number, cache?: Map<Fingerprint, Set<NodeId>>, isGraphVertex?: (id: NodeId) => boolean, gas?: ReadOnlyFlowrAnalyzerGasContext) {
		this.threshold = threshold;
		this.cache     = cache;
		this.isGraphVertex = isGraphVertex;
		this.gas = gas;
	}

	/**
	 * Adds a node to the queue if it has not been seen before.
	 * @param target             - the node to add
	 * @param env                - the environment the node is traversed in
	 * @param envFingerprint     - the fingerprint of the environment
	 * @param onlyForSideEffects - whether the node is only used for its side effects
	 */
	public add(target: NodeId, env: REnvironmentInformation, envFingerprint: string, onlyForSideEffects: boolean): void {
		/* a built-in without a vertex is R's own definition (`x <- 1` reads `built-in:<-`), a dead end the traversal
		 * would drop right back out of, so it only ever widened the result */
		if(NodeId.isBuiltIn(target) && this.isGraphVertex?.(target) === false) {
			return;
		}

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

	/** Whether there is anything left to visit, which the traversal is out of gas for as soon as it is exhausted. */
	public nonEmpty(): boolean {
		return this.queue.length > 0 && !this.outOfGas();
	}

	/**
	 * The traversal is synchronous, so a caller can only bound it from within. Gas is polled every
	 * {@link GasCheckEvery} nodes, which keeps even an enabled check off the per-node path.
	 */
	private outOfGas(): boolean {
		if(this.gas === undefined || this.untilGasCheck-- > 0) {
			return this.stoppedEarly;
		}
		this.untilGasCheck = GasCheckEvery - 1;
		if(!this.stoppedEarly && this.gas.checkGas(GasFeatureKey.Slicer) >= GasLevel.Critical) {
			this.stoppedEarly = true;
			slicerLogger.warn(`slicing ran out of gas, the slice is incomplete (${GasWikiRef})`);
		}
		return this.stoppedEarly;
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

	public status(): Readonly<Pick<SliceResult, 'timesHitThreshold' | 'result' | 'stoppedEarly'>> {
		return {
			timesHitThreshold: this.timesHitThreshold,
			result:            new Set([...this.seen.values(), ...this.seenByCache]),
			...(this.stoppedEarly ? { stoppedEarly: true } : {})
		};
	}
}
