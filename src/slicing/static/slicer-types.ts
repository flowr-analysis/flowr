import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';


/**
 * Represents a node during the slicing process, together with the environment it is traversed in
 * (modified by function calls) and whether it is only used for its side effects.
 */
export interface NodeToSlice {
	readonly id:                 NodeId
	/** used for calling context, etc. */
	readonly baseEnvironment:    REnvironmentInformation
	/** the fingerprint of the environment */
	readonly envFingerprint:     string
	/** if we add a function call, we may need it only for its side effects (e.g., a redefinition of a global variable), if so, 'returns' links will not be traced */
	readonly onlyForSideEffects: boolean
}

/**
 * The result of the slice step
 */
export interface SliceResult {
	/**
	 * Number of times the set threshold was hit (i.e., the same node was visited too often).
	 * While any number above 0 might indicate a wrong slice, it does not have to as usually even revisiting the same node
	 * seldom causes more ids to be included in the slice.
	 */
	readonly timesHitThreshold: number
	/**
	 * The ids of the nodes in the normalized ast that are part of the slice.
	 */
	readonly result:            ReadonlySet<NodeId>
	/**
	 * The ids of the nodes in the normalized ast that were used as seed ids for slicing. This is a subset of {@link result}.
	 */
	readonly slicedFor:         readonly NodeId[]
	/**
	 * Set when the {@link GasFeatureKey.Slicer|gas guard} stopped the traversal before the queue drained, so
	 * {@link result} is what was reached until then and not the complete slice.
	 */
	readonly stoppedEarly?:     boolean
	/**
	 * The names the slice reads without defining them, so running it on its own would fail with
	 * `object 'x' not found`. Empty when the slice is closed under the names it uses.
	 */
	readonly freeNames?:        readonly string[]
}
