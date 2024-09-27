import type { ControlFlowGraph } from './cfg';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

/**
 * Visit all nodes reachable from the start node in the control flow graph, traversing the dependencies but ignoring cycles.
 * @param graph     - The control flow graph.
 * @param startNode - The node to start the traversal from.
 * @param visitor   - The visitor function to call for each node, if you return true the traversal from this node will be stopped.
 */
export function visitInReverseOrder(
	graph: ControlFlowGraph,
	startNode: NodeId,
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- void is used to indicate that the return value is ignored/we never stop
	visitor: (node: NodeId) => boolean | void
): void {
	const visited = new Set<NodeId>();
	const queue = [startNode];
	while(queue.length > 0) {
		const current = queue.pop() as NodeId;
		if(visited.has(current)) {
			continue;
		}
		visited.add(current);
		if(visitor(current)) {
			continue;
		}
		const incoming = graph.outgoing(current) ?? [];
		for(const [from] of incoming) {
			queue.push(from);
		}
	}
}
