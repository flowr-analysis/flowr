import type { ControlFlowGraph } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

/**
 * Visit all nodes reachable from the start node in the control flow graph, traversing the dependencies but ignoring cycles.
 * @param graph     - The control flow graph.
 * @param startNode - The node to start the traversal from.
 * @param visitor   - The visitor function to call for each node, if you return true the traversal from this node will be stopped.
 *
 * @see {@link visitCfgInOrder} for a traversal in order
 */
export function visitCfgInReverseOrder(
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

/**
 * Visit all nodes reachable from the start node in the control flow graph, traversing the dependencies in execution order but ignoring cycles.
 * @param graph     - The control flow graph.
 * @param startNode - The node to start the traversal from.
 * @param visitor   - The visitor function to call for each node, if you return true the traversal from this node will be stopped.
 *
 * @see {@link visitCfgInReverseOrder} for a traversal in reversed order
 */
export function visitCfgInOrder(
	graph: ControlFlowGraph,
	startNode: NodeId,
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- void is used to indicate that the return value is ignored/we never stop
	visitor: (node: NodeId) => boolean | void
): void {
	const visited = new Set<NodeId>();
	const queue = [startNode];
	while(queue.length > 0) {
		const current = queue.shift() as NodeId;
		if(visited.has(current)) {
			continue;
		}
		visited.add(current);
		if(visitor(current)) {
			continue;
		}
		const outgoing = graph.ingoing(current) ?? [];
		for(const [to] of outgoing) {
			queue.push(to);
		}
	}
}