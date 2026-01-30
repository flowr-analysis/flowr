import { type ControlFlowGraph , CfgVertexType } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export type SimpleCfgVisitor = (graph: ControlFlowGraph, nodes: readonly NodeId[], visitor: (node: NodeId) => boolean | void) => void;

/**
 * Visit all nodes reachable from the start node in the control flow graph, traversing the dependencies but ignoring cycles.
 * @param graph     - The control flow graph.
 * @param startNodes - The nodes to start the traversal from.
 * @param visitor   - The visitor function to call for each node, if you return true the traversal from this node will be stopped.
 *
 * This function is of type {@link SimpleCfgVisitor}.
 * @see {@link visitCfgInOrder} for a traversal in order
 */
export function visitCfgInReverseOrder(
	graph: ControlFlowGraph,
	startNodes: readonly NodeId[],
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- void is used to indicate that the return value is ignored/we never stop
	visitor: (node: NodeId) => boolean | void
): void {
	const visited = new Set<NodeId>();
	let queue = startNodes.slice();
	const hasBb = graph.mayHaveBasicBlocks();
	while(queue.length > 0) {
		const current = queue.pop() as NodeId;
		if(visited.has(current)) {
			continue;
		}
		visited.add(current);
		if(visitor(current)) {
			continue;
		} else if(hasBb) {
			const get = graph.getVertex(current);
			if(get?.type === CfgVertexType.Block) {
				queue = queue.concat(get.elems.toReversed().map(e => e.id));
			}
		}
		const incoming = graph.outgoingEdges(current);
		if(incoming) {
			for(const c of incoming.keys()) {
				queue.push(c);
			}
		}
	}
}

/**
 * Visit all nodes reachable from the start node in the control flow graph, traversing the dependencies in execution order but ignoring cycles.
 * @param graph      - The control flow graph.
 * @param startNodes - The nodes to start the traversal from.
 * @param visitor    - The visitor function to call for each node, if you return true the traversal from this node will be stopped.
 *
 * This function is of type {@link SimpleCfgVisitor}.
 * @see {@link visitCfgInReverseOrder} for a traversal in reversed order
 */
export function visitCfgInOrder(
	graph: ControlFlowGraph,
	startNodes: readonly NodeId[],
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- void is used to indicate that the return value is ignored/we never stop
	visitor: (node: NodeId) => boolean | void
): Set<NodeId> {
	const visited = new Set<NodeId>();
	let queue = startNodes.slice();
	const hasBb = graph.mayHaveBasicBlocks();
	while(queue.length > 0) {
		const current = queue.shift() as NodeId;
		if(visited.has(current)) {
			continue;
		}
		visited.add(current);
		if(visitor(current)) {
			continue;
		} else if(hasBb) {
			const get = graph.getVertex(current);
			if(get?.type === CfgVertexType.Block) {
				queue = queue.concat(get.elems.map(e => e.id));
			}
		}
		const outgoing = graph.ingoingEdges(current) ?? [];
		for(const [to] of outgoing) {
			queue.push(to);
		}
	}
	return visited;
}

/**
 * Check if a node can reach another node in the control flow graph.
 */
export function canReach(
	graph: ControlFlowGraph,
	from: NodeId[],
	to: NodeId
): boolean {
	let reached = false;
	visitCfgInOrder(graph, from, node => {
		if(node === to) {
			reached = true;
			return true;
		}
	});
	return reached;
}