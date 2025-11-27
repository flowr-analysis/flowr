import { DataflowGraph } from './graph';
import type { REnvironmentInformation } from '../environments/environment';


/**
 * Inverts the given dataflow graph by reversing all edges.
 */
export function invertDfg(graph: DataflowGraph, cleanEnv: REnvironmentInformation): DataflowGraph {
	const invertedGraph = new DataflowGraph(graph.idMap);
	for(const [,v] of graph.vertices(true)) {
		invertedGraph.addVertex(v, cleanEnv);
	}
	for(const [from, targets] of graph.edges()) {
		for(const [to, { types }] of targets) {
			invertedGraph.addEdge(to, from, types);
		}
	}
	return invertedGraph;
}