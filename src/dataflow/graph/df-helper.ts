import { DataflowGraph } from './graph';
import { DfEdge } from './edge';
import { emptyGraph } from './dataflowgraph-builder';
import { getOriginInDfg } from '../origin/dfg-get-origin';
import { GraphHelper } from './graph-helper';
import { CallGraph } from './call-graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';

/**
 * This is the root helper object to work with the {@link DataflowGraph}.
 *
 * - {@link Dataflow.visualize} - for visualization helpers (e.g., rendering the DFG as a mermaid graph),
 * - {@link Dataflow.views} - for working with specific views of the dataflow graph (e.g., the call graph),
 * - {@link Dataflow.edge} - for working with the edges in the dataflow graph,
 */
export const Dataflow = {
	name:  'Dataflow',
	/**
	 * Maps to flowR's main graph object to store and manipulate the dataflow graph
	 * @see {@link DataflowGraph}
	 */
	graph: DataflowGraph,
	...GraphHelper,
	/**
	 * Maps to flowR's dataflow edge helper to work with the edges in the dataflow graph
	 */
	edge:  DfEdge,
	/**
	 * Dispatches to helper objects that relate to (sub-) views of the dataflow graph, e.g. the call graph.
	 */
	views: {
		/**
		 * Maps to flowR's helper object for the call-graph
		 */
		callGraph: CallGraph,
	},
	/**
	 * Dispatches to helper functions to create new dataflow graphs, e.g. from a pipeline or an empty graph.
	 */
	create: {
		/**
		 * Creates an empty dataflow graph with the given id map (or a new one if not provided).
		 * @see {@link emptyGraph}
		 */
		empty: emptyGraph
	},
	/**
	 * Returns the origin of a vertex in the dataflow graph
	 * @see {@link getOriginInDfg} - for the underlying function
	 */
	origin: getOriginInDfg,
	/**
	 * Only returns the sub-part of the graph that is determined by the given selection.
	 * In other words, this will return a graph with only vertices that are part of the selected ids,
	 * and edges that are between such selected vertices.
	 * @param graph - the dataflow graph to slice for
	 * @param select - the ids to select in the reduced graph
	 */
	reduceGraph(this: void, graph: DataflowGraph, select: ReadonlySet<NodeId>): DataflowGraph {
		const df = new DataflowGraph(graph.idMap);
		const roots = graph.rootIds();
		for(const [id, vtx] of graph.vertices(true)) {
			if(select.has(id)) {
				df.addVertex(
					vtx,
					vtx.environment as unknown as REnvironmentInformation,
					roots.has(id)
				);
			}
		}
		for(const [from, targets] of graph.edges()) {
			for(const [tar, { types }] of targets.entries()) {
				df.addEdge(from, tar, types);
			}
		}
		for(const u of graph.unknownSideEffects) {
			if(typeof u === 'object' && select.has(u.id)) {
				df.markIdForUnknownSideEffects(u.id, u.linkTo);
			} else if(select.has(u as NodeId)) {
				df.markIdForUnknownSideEffects(u as NodeId);
			}
		}
		return df;
	}
} as const;
