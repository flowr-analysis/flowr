import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { CallGraph } from '../graph/call-graph';

/**
 * Determines whether the function with the given ID is recursive.
 * @useInstead {@link CallGraph.isRecursive}
 */
export function isFunctionRecursive(id: NodeId, graph: CallGraph): boolean {
	return CallGraph.isRecursive(id, graph);
}
