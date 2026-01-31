import { ControlFlowGraph } from './control-flow-graph';


/**
 * Inverts the given dataflow graph by reversing all edges.
 */
export function invertCfg(graph: ControlFlowGraph): ControlFlowGraph {
	const invertedGraph = new ControlFlowGraph();
	for(const [,v] of graph.vertices(true)) {
		invertedGraph.addVertex(v);
	}
	for(const [from, targets] of graph.edges()) {
		for(const [to, t] of targets) {
			invertedGraph.addEdge(to, from, t);
		}
	}
	return invertedGraph;
}