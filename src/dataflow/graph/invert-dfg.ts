import { DataflowGraph } from './graph';

export function invertDfg(graph: DataflowGraph): DataflowGraph {
	const invertedGraph = new DataflowGraph(graph.idMap);
	for(const [,v] of graph.vertices(true)) {
		invertedGraph.addVertex(v);
	}
	for(const [from, targets] of graph.edges()) {
		for(const [to, { types }] of targets) {
			invertedGraph.addEdge(to, from, types);
		}
	}
	return invertedGraph;
}