import type { DataflowGraph } from './graph/graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { edgeDoesNotIncludeType, EdgeType } from './graph/edge';
import type { DataflowGraphVertexInfo } from './graph/vertex';
import { resolveByName } from './environments/resolve-by-name';

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
			members:               [...makeCluster(graph, startNode, notReached).add(startNode)],
			hasUnknownSideEffects: graph.unknownSideEffects.has(startNode)
		});
	}
	return clusters;
}

function makeCluster(graph: DataflowGraph, from: NodeId, notReached: Set<NodeId>): Set<NodeId> {
	const info = graph.getVertex(from) as DataflowGraphVertexInfo;
	const calledFunction = getCalledFunction(info);
	const nodes = new Set<NodeId>();

	// cluster function def exit points
	if(info.tag == 'function-definition') {
		for(const sub of info.exitPoints){
			if(notReached.delete(sub)) {
				nodes.add(sub);
				makeCluster(graph, sub, notReached).forEach(n => nodes.add(n));
			}
		}
	}

	// TODO scopes (loops, function defs etc.) should be *included* in all clusters they reference, but not *join* them into one
	// cluster adjacent edges
	for(const [dest, { types }] of [...graph.outgoingEdges(from) ?? [], ...graph.ingoingEdges(from) ?? []]) {
		// don't cluster for non-standard evaluation
		if(types == EdgeType.NonStandardEvaluation) {
			continue;
		}
		// don't cluster for function content if it isn't returned
		if(edgeDoesNotIncludeType(types, EdgeType.Returns) && calledFunction == '{'){
			continue;
		}
		if(notReached.delete(dest)) {
			nodes.add(dest);
			makeCluster(graph, dest, notReached).forEach(n => nodes.add(n));
		}	
	}

	return nodes;
}

function getCalledFunction(info: DataflowGraphVertexInfo): string | undefined {
	if(info.tag != 'function-call') {
		return undefined;
	}
	if(!info.environment) {
		return info.onlyBuiltin ? info.name : undefined;
	}
	const defs = resolveByName(info.name, info.environment)?.filter(d => d.kind == 'built-in-function');
	return defs?.length == 1 ? defs[0].name : undefined;
}
