import type {DataflowGraph} from './graph/graph';
import type {NodeId} from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import {edgeDoesNotIncludeType, edgeIncludesType, EdgeType} from './graph/edge';
import {VertexType} from './graph/vertex';
import {guard} from "../util/assert";
import {log} from "../util/log";

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

/** maps each node to the cluster number it belongs to */
type ClusterMap = Map<NodeId, number>;

export function findAllClusters(graph: DataflowGraph): DataflowGraphClusters {
	// we reverse the vertices since dependencies usually point "backwards" from later nodes
	const clusterMap: ClusterMap = new Map();
	let clusterCount = 0;
	for(const [id, info] of graph.vertices(true)) {
		if(clusterMap.has(id)) {
			continue;
		}
		const cluster = populateCluster(graph, id, clusterMap, clusterCount++);
		const destructured = [...cluster];
/*		clusters.push({
			startNode:             startNode,
			members:               destructured,
			hasUnknownSideEffects: destructured.some(m => graph.unknownSideEffects.has(m))
		});*/
	}
	const clusters: DataflowGraphClusters = [];

	return clusters;
}

function addAllToCluster(c: ReadonlySet<NodeId>, nodes: Set<NodeId>): void {
	for(const n of c){
		nodes.add(n);
	}
}

const splitOnBuiltIns = ['for', 'while', 'if', 'function', 'switch']

function populateCluster(graph: DataflowGraph, from: NodeId, clusterMap: ClusterMap, clusterId: number): Set<NodeId> {
	const info = graph.getVertex(from);
	guard(info !== undefined, `Vertex ${from} not found`);

	let assumedClusterId: NodeId | undefined | 'multi' = undefined;
	const assumeCluster = (id?: NodeId) => {
		if(assumedClusterId === undefined) {
			assumedClusterId = id;
		} else if(assumedClusterId !== 'multi') {
			log.warn(`Assuming cluster ${id} while already assuming ${assumedClusterId}, will not add this!`);
			assumedClusterId = 'multi';
		}
	}

	const toCluster: NodeId[] = []
	// cluster function def exit points
	if(info.tag === VertexType.FunctionDefinition) {
		for(const sub of info.exitPoints) {
			const has = clusterMap.get(sub);
			assumeCluster(has);
			if(!has) {
				toCluster.push(sub);
			}
		}
	}

	const outgoing = [...graph.outgoingEdges(from) ?? []]
	// cluster adjacent edges
	for(const [dest, { types }] of outgoing) {
		/* use nse to skip and use extra cluster */
		if(edgeIncludesType(types, EdgeType.NonStandardEvaluation)){
			continue;
		}
		// don't cluster for function content if it isn't returned
		if(edgeDoesNotIncludeType(types, EdgeType.Returns) && info.onlyBuiltin && info.name == '{'){
			continue;
		}
		const has = clusterMap.get(dest);
		assumeCluster(has);
		if(!has) {
			toCluster.push(dest);
		}
	}

	/* control dependencies should always be added (if not already _in_ the cluster, they may be there multiple times) */
	for(const { id } of info.controlDependencies ?? []) {
		const has = clusterMap.get(id);
		assumeCluster(has);
		if(!has) {
			toCluster.push(id);
		}
	}

	const nodes = new Set<NodeId>()
	const clusterIdWeAre = assumedClusterId ?? clusterId;
	if(assumedClusterId === 'multi') {
		/* if we are part of multiple clusters, we do not taint all dependencies in the cluster */
		clusterMap = new Map(clusterMap);
	}
	clusterMap.set(from, clusterIdWeAre);
	for(const n of toCluster){
		addAllToCluster(populateCluster(graph, n, clusterMap, clusterIdWeAre), nodes);
	}

	return nodes;
}
