import type { DataflowGraph } from './graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Dataflow } from './df-helper';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { DfEdge, EdgeType } from './edge';

const FollowEdges = EdgeType.Calls | EdgeType.Reads | EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;

/**
 * Given the id of a vertex (usually a variable use),
 * this returns the full provenance graph by calculating the backward slice
 * of the id and returning only vertices and edges that are fully enclosed in the dataflow graph.
 */
export function calculateProvenance(id: NodeId, graph: DataflowGraph, idMap: AstIdMap): DataflowGraph {
	const queue = [id];
	const visited = new Set<NodeId>();
	// TODO: check and continue from here
	while(queue.length > 0) {
		const nodeId = queue.pop();
		if(!nodeId || visited.has(nodeId)) {
			continue;
		}
		visited.add(nodeId);
		const node = idMap.get(nodeId);
		// we stop at parameters
		if(RParameter.is(node)) {
			continue;
		}
		for(const [to, types] of graph.outgoingEdges(nodeId) ?? []) {
			if(DfEdge.includesType(types, FollowEdges)) {
				queue.push(to);
			}
		}
	}
	return Dataflow.reduceGraph(graph, visited);
}