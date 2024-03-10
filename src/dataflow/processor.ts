/**
 * Based on a two-way fold, this processor will automatically supply scope information
 */
import type { NodeId, NormalizedAst, ParentInformation, RNode, RNodeWithParent, RParseRequest } from '../r-bridge'
import type { REnvironmentInformation } from './environments'
import type { DataflowInformation } from './info'

export interface DataflowProcessorInformation<OtherInfo> {
	/**
   * Initial and frozen ast-information
   */
	readonly completeAst:             NormalizedAst<OtherInfo>
	/**
   * Correctly contains pushed local scopes introduced by `function` scopes.
   * Will by default *not* contain any symbol-bindings introduces along the way, they have to be decorated when moving up the tree.
   */
	readonly environment:             REnvironmentInformation
	/**
   * Other processors to be called by the given functions
   */
	readonly processors:              DataflowProcessors<OtherInfo>
	/**
	 * The {@link RParseRequest} that is currently being parsed
	 */
	readonly currentRequest:          RParseRequest
	/**
	 * The chain of {@link RParseRequest} fingerprints ({@link requestFingerprint}) that lead to the {@link currentRequest}.
	 * The most recent (last) entry is expected to always be the {@link currentRequest}.
	 */
	readonly referenceChain:          string[]
	/**
	 * The chain of control-flow {@link NodeId}s that lead to the current node (e.g. of known ifs).
	 */
	readonly controlFlowDependencies: NodeId[] | undefined
}

export type DataflowProcessor<OtherInfo, NodeType extends RNodeWithParent<OtherInfo>> = (node: NodeType, data: DataflowProcessorInformation<OtherInfo>) => DataflowInformation

type NodeWithKey<OtherInfo, Key> = RNode<OtherInfo & ParentInformation> & { type: Key }

/**
 * This way, a processor mapped to a {@link RType#Symbol} require a {@link RSymbol} as first parameter and so on.
 */
export type DataflowProcessors<OtherInfo> = {
	[key in RNode['type']]: DataflowProcessor<OtherInfo, NodeWithKey<OtherInfo, key>>
}

/**
 * Originally, dataflow processor was written as a two-way fold, but this produced problems when trying to resolve function calls
 * which require information regarding the calling *and* definition context. While this only is a problem for late bindings as they happen
 * with functions (and probably quote'd R-expressions) it is still a problem that must be dealt with.
 * Therefore, the dataflow processor has no complete control over the traversal and merge strategy of the graph, with each processor being in
 * the position to call the other processors as needed for its children.
 * <p>
 * Now this method can be called recursively within the other processors to parse the dataflow for nodes that you can not narrow down.
 *
 * @param current - The current node to start processing from
 * @param data    - The initial (/current) information to be passed down
 */
export function processDataflowFor<OtherInfo>(
	current: RNode<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	return (data.processors[current.type] as DataflowProcessor<OtherInfo & ParentInformation, typeof current>)(current, data)
}
