import type {DataflowGraph} from './graph/graph';
import type {NodeId} from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import {edgeDoesNotIncludeType, edgeIncludesType, EdgeType, edgeTypesToNames} from './graph/edge';
import {VertexType} from './graph/vertex';
import {guard} from "../util/assert";

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

export function findAllClusters(graph: DataflowGraph): DataflowGraphClusters {
	const clusters: DataflowGraphClusters = [];
	// we reverse the vertices since dependencies usually point "backwards" from later nodes
	const notReached = new Set<NodeId>([...graph.vertices(true)].map(([id]) => id).reverse());
	while(notReached.size > 0){
		const [startNode] = notReached;
		notReached.delete(startNode);
		const cluster = makeCluster(graph, startNode, notReached);
		if(cluster === 'exclude') {
			continue;
		}
		const destructured = [...cluster];
		clusters.push({
			startNode:             startNode,
			members:               destructured,
			hasUnknownSideEffects: destructured.some(m => graph.unknownSideEffects.has(m))
		});
	}
	return clusters;
}

function addAllToCluster(c: ReadonlySet<NodeId> | 'exclude', nodes: Set<NodeId>): void {
	if(c !== 'exclude') {
		c.forEach(n => nodes.add(n));
	}
}

function makeCluster(graph: DataflowGraph, from: NodeId, notReached: Set<NodeId>): Set<NodeId> | 'exclude' {
	const info = graph.getVertex(from);
	guard(info !== undefined, `Vertex ${from} not found`);
	const nodes = new Set<NodeId>([from]);

	// cluster function def exit points
	if(info.tag === VertexType.FunctionDefinition) {
		for(const sub of info.exitPoints){
			if(notReached.delete(sub)) {
				addAllToCluster(makeCluster(graph, sub, notReached), nodes)
			}
		}
	}

	const ingoing = [...graph.ingoingEdges(from) ?? []].map(i => ['in', i] as const)
	const outgoing = [...graph.outgoingEdges(from) ?? []].map(o => ['out', o] as const)
	const both = [...outgoing, ...ingoing];
	// cluster adjacent edges
	for(const [t, [dest, { types }]] of both) {
		if(edgeIncludesType(types, EdgeType.NonStandardEvaluation)) {
			/** if we have an ingoing nse, the whole vertex is disabled */
			console.log(from, dest, t, edgeTypesToNames(types))
			if(t === 'in') {
				return 'exclude'
			}
			continue;
		}
		// don't cluster for function content if it isn't returned
		if(edgeDoesNotIncludeType(types, EdgeType.Returns) && info.onlyBuiltin && info.name == '{'){
			continue;
		}
		if(notReached.delete(dest)) {
			addAllToCluster(makeCluster(graph, dest, notReached), nodes)
		}
	}

	return nodes;
}
