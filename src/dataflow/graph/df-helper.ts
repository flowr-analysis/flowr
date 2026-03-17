import { DataflowGraph } from './graph';
import { DfEdge, EdgeType } from './edge';
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
	 * @param graph                 - the dataflow graph to slice for
	 * @param select                - the ids to select in the reduced graph
	 * @param includeMissingTargets - if set to true, this will include edges which target vertices that are not selected!
	 */
	reduceGraph<G extends DataflowGraph>(this: void, graph: G, select: ReadonlySet<NodeId>, includeMissingTargets = false): G {
		const df = new DataflowGraph(graph.idMap);
		const roots = graph.rootIds();
		// if the graph has no root ids all selected vertices are non-root in this case we just break the fdef selection and promote all to root!
		const selectedRoots = roots.intersection(select);
		const forceRoot = selectedRoots.size === 0;
		for(const [id, vtx] of graph.vertices(true)) {
			if(select.has(id)) {
				df.addVertex(
					vtx,
					vtx.environment as unknown as REnvironmentInformation,
					forceRoot || roots.has(id)
				);
			}
		}

		for(const [from, targets] of graph.edges()) {
			if(!select.has(from)) {
				continue;
			}
			for(const [tar, { types }] of targets.entries()) {
				if(!includeMissingTargets && !select.has(tar)) {
					continue;
				}
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
		return df as G;
	},

	/**
	 * Given the id of a vertex (usually a variable use),
	 * this returns a reachable provenance set by calculating a non-interprocedural and non-context sensitive backward slice, but stopping at the given ids!
	 * You can obtain the corresponding graph using {@link Dataflow.reduceGraph}.
	 * @param id       - The id to use as a seed for provenance calculation
	 * @param graph    - The graph to perform the provenance calculation on
	 * @param consider - The ids to restrict the calculation too (e.g., the ids contained within a function definition to restrict the analysis to)
	 * @see {@link Dataflow.provenanceGraph} - for a convenience wrapper to directly obtain the graph of the provenance.
	 */
	provenance(this: void, id: NodeId, graph: DataflowGraph, consider?: ReadonlySet<NodeId>): Set<NodeId> {
		const queue = [id];
		const visited = new Set<NodeId>();
		const followEdges = EdgeType.Calls | EdgeType.Reads | EdgeType.Returns | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;

		while(queue.length > 0) {
			const nodeId = queue.pop();
			if(nodeId === undefined || visited.has(nodeId) || (consider && !consider.has(nodeId))) {
				continue;
			}
			visited.add(nodeId);
			for(const [to, types] of graph.outgoingEdges(nodeId) ?? []) {
				if(DfEdge.includesType(types, followEdges)) {
					queue.push(to);
				}
			}
		}
		return visited;
	},
	/**
	 * A convenience wrapper for {@link Dataflow.reduceGraph|reducing} the {@link Dataflow.provenance|provenance} of a graph.
	 * @param id       - The id to use as a seed for provenance calculation
	 * @param graph    - The graph to perform the provenance calculation on
	 * @param consider - The ids to restrict the calculation too (e.g., the ids contained within a function definition to restrict the analysis to)
	 * @see {@link Dataflow.provenance}
	 */
	provenanceGraph(this: void, id: NodeId, graph: DataflowGraph, consider?: ReadonlySet<NodeId>): DataflowGraph {
		return Dataflow.reduceGraph(graph, Dataflow.provenance(id, graph, consider));
	}
} as const;
