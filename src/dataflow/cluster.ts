import type { DataflowGraph } from './graph/graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

export type DataflowGraphClusters = DataflowGraphCluster[];
export interface DataflowGraphCluster {
	readonly startNode: NodeId;
	readonly members:   readonly NodeId[];
}

export function findAllClusters(graph: DataflowGraph): DataflowGraphClusters {
	const clusters: DataflowGraphClusters = [];
	const notReached = new Set<NodeId>([...graph.vertices(true)].map(([id]) => id));
	/* TODO: probably it is best to start from back to front ? */
	while(notReached.size > 0){
		const [startNode] = notReached;
		notReached.delete(startNode);
		clusters.push({ startNode: startNode, members: [startNode, ...cluster(graph, startNode, notReached)] });
	}
	return clusters;
}

function cluster(graph: DataflowGraph, from: NodeId, notReached: Set<NodeId>): NodeId[] {
	const edges: NodeId[] = [];
	// TODO determine edge types that should actually be followed?
	for(const [dest, { types }] of [...graph.outgoingEdges(from) ?? [], ...graph.ingoingEdges(from) ?? []]) {
		// TODO just deleting these is insufficient, examples like: edge(0, 1) + edge(1, 0)
		if(notReached.delete(dest)) {
			edges.push(dest);
			edges.push(...cluster(graph, dest, notReached));
		}
	}
	return edges;
}
