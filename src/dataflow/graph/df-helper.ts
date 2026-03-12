import { DataflowGraph } from './graph';
import { DfEdge } from './edge';
import { emptyGraph } from './dataflowgraph-builder';
import { getOriginInDfg } from '../origin/dfg-get-origin';
import { GraphHelper } from './graph-helper';
import { CallGraph } from './call-graph';

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
	origin: getOriginInDfg
} as const;
