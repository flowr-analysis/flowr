import type { DataflowGraph } from './graph/graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { edgeIncludesType, EdgeType } from './graph/edge';

export type DataflowGraphClusters = DataflowGraphCluster[];
export interface DataflowGraphCluster {
	readonly startNode:             NodeId;
	readonly members:               readonly NodeId[];
	readonly hasUnknownSideEffects: boolean;
}

export function findAllClusters(graph: DataflowGraph): DataflowGraphClusters {
	const clusters: DataflowGraphClusters = [];
	// we reverse the vertices since dependencies usually point "backwards" from later nodes
	const notReached = new Set<NodeId>([...graph.vertices(true)].map(([id]) => id).reverse());
	while(notReached.size > 0){
		const [startNode] = notReached;
		notReached.delete(startNode);
		clusters.push({
			startNode:             startNode,
			members:               [startNode, ...makeCluster(graph, startNode, notReached)],
			hasUnknownSideEffects: graph.unknownSideEffects.has(startNode)
		});
	}
	return clusters;
}

function makeCluster(graph: DataflowGraph, from: NodeId, notReached: Set<NodeId>): NodeId[] {
	const nodes: NodeId[] = [];

	// cluster function def subflows
	const info = graph.getVertex(from);
	if(info && info.tag == 'function-definition') {
		for(const sub of info.subflow.graph){
			addNodeAndCluster(nodes, sub,graph, notReached);
		}
	}

	// cluster adjacent edges
	for(const [dest, { types }] of [...graph.outgoingEdges(from) ?? [], ...graph.ingoingEdges(from) ?? []]) {
		if(edgeIncludesType(types, EdgeType.NonStandardEvaluation)) {
			continue;
		}
		addNodeAndCluster(nodes, dest, graph, notReached);
	}

	return nodes;
}

function addNodeAndCluster(nodes: NodeId[], node: NodeId, graph: DataflowGraph, notReached: Set<NodeId>, force = false): boolean {
	if(force || notReached.delete(node)) {
		nodes.push(node);
		nodes.push(...makeCluster(graph, node, notReached));
		return true;
	}
	return false;
}
