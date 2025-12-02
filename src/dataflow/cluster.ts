import type { DataflowGraph } from './graph/graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { edgeDoesNotIncludeType, EdgeType } from './graph/edge';
import { VertexType } from './graph/vertex';
import { guard } from '../util/assert';

export type DataflowGraphClusters = DataflowGraphCluster[];
export interface DataflowGraphCluster {
	/**
	 * The node which started the cluster,
	 * as this is theoretically picked random, there are just two guarantees you can rely on:
	 *
	 * 1. The node is part of the `members` as well
	 * 2. At one point during the clustering, the node wsa considered as a starting point
	 *
	 * In general, this is more of a debugging aid/representative of the cluster.
	 */
	readonly startNode:             NodeId;
	/** All nodes that are part of this cluster */
	readonly members:               readonly NodeId[];
	/** If the cluster contains unknown side effects */
	readonly hasUnknownSideEffects: boolean;
}

/**
 * Find all clusters in the given dataflow graph.
 */
export function findAllClusters(graph: DataflowGraph): DataflowGraphClusters {
	const clusters: DataflowGraphClusters = [];
	// we reverse the vertices since dependencies usually point "backwards" from later nodes
	const notReached = new Set<NodeId>(graph.vertices(true).map(([id]) => id).toArray().reverse());
	while(notReached.size > 0){
		const [startNode] = notReached;
		notReached.delete(startNode);
		clusters.push({
			startNode:             startNode,
			members:               Array.from(makeCluster(graph, startNode, notReached)),
			hasUnknownSideEffects: graph.unknownSideEffects.has(startNode)
		});
	}
	return clusters;
}

function makeCluster(graph: DataflowGraph, from: NodeId, notReached: Set<NodeId>): Set<NodeId> {
	const info = graph.getVertex(from);
	guard(info !== undefined, () => `Vertex ${from} not found in graph`);
	const nodes = new Set<NodeId>([from]);

	// cluster function def exit points
	if(info.tag === VertexType.FunctionDefinition) {
		for(const sub of info.exitPoints){
			if(notReached.delete(sub)) {
				makeCluster(graph, sub, notReached).forEach(n => nodes.add(n));
			}
		}
	}

	// cluster adjacent edges
	for(const [dest, { types }] of [...graph.outgoingEdges(from) ?? [], ...graph.ingoingEdges(from) ?? []]) {
		// don't cluster for function content if it isn't returned
		if(edgeDoesNotIncludeType(types, EdgeType.Returns) && info.onlyBuiltin && info.name == '{'){
			continue;
		}
		if(notReached.delete(dest)) {
			makeCluster(graph, dest, notReached).forEach(n => nodes.add(n));
		}
	}

	return nodes;
}
