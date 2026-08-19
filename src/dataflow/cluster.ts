import type { DataflowGraph, IngoingEdges } from './graph/graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DfEdge, EdgeType } from './graph/edge';
import { guard } from '../util/assert';
import { FunctionDefinitionVertex } from './graph/vertex';

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
	const ids = graph.vertices(true).map(([id]) => id).toArray().reverse();
	/* walking the ids picks the same start nodes in the same order as draining the set did, without re-opening an
	 * iterator over the shrinking set for every cluster */
	const notReached = new Set<NodeId>(ids);
	/* `graph.ingoingEdges` rebuilds the reverse adjacency by scanning every edge of the graph, and clustering asks
	 * for it once per node; building it a single time turns that quadratic sweep into one pass */
	const incoming = new Map<NodeId, IngoingEdges>();
	for(const [source, outgoing] of graph.edges()) {
		for(const [target, edge] of outgoing) {
			const into = incoming.get(target);
			if(into === undefined) {
				incoming.set(target, new Map([[source, edge]]));
			} else {
				into.set(source, edge);
			}
		}
	}
	for(const startNode of ids) {
		if(!notReached.delete(startNode)) {
			continue;
		}
		clusters.push({
			startNode:             startNode,
			members:               Array.from(makeCluster(graph, startNode, notReached, incoming)),
			hasUnknownSideEffects: graph.unknownSideEffects.has(startNode)
		});
	}
	return clusters;
}

/* one shared accumulator, filled iteratively: merging a set per node cost a copy of the whole cluster per member
 * (quadratic in the cluster size), and the recursion ran as deep as the cluster was large */
function makeCluster(graph: DataflowGraph, from: NodeId, notReached: Set<NodeId>, incoming: ReadonlyMap<NodeId, IngoingEdges>): Set<NodeId> {
	const nodes = new Set<NodeId>([from]);
	const pending: NodeId[] = [from];

	while(pending.length > 0) {
		const current = pending.pop() as NodeId;
		const info = graph.getVertex(current);
		guard(info !== undefined, () => `Vertex ${current} not found in graph`);

		function reach(dest: NodeId): void {
			if(notReached.delete(dest)) {
				nodes.add(dest);
				pending.push(dest);
			}
		}

		// cluster function def exit points
		if(FunctionDefinitionVertex.is(info)) {
			for(const { nodeId } of info.exitPoints){
				reach(nodeId);
			}
		}

		// cluster adjacent edges
		for(const edges of [graph.outgoingEdges(current), incoming.get(current)] as const) {
			for(const [dest, e] of edges ?? []) {
				// don't cluster for function content if it isn't returned
				if(DfEdge.doesNotIncludeType(e, EdgeType.Returns) && info.onlyBuiltin && info.name === '{') {
					continue;
				}
				reach(dest);
			}
		}
	}

	return nodes;
}
