import { DataflowGraph } from './graph';
import { DfEdge, EdgeType } from './edge';
import { emptyGraph } from './dataflowgraph-builder';
import { getOriginInDfg } from '../origin/dfg-get-origin';
import { GraphHelper } from './graph-helper';
import { CallGraph } from './call-graph';
import { computeCallGraphSummaries, propagateTransitiveSideEffects } from '../internal/process/functions/call/built-in/transitive-side-effects';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { DataflowGraphVertexInfo } from './vertex';
import { isFunctionCallVertex } from './vertex';
import { Identifier } from '../environments/identifier';

/**
 * This is the root helper object to work with the {@link DataflowGraph}.
 *
 * - {@link Dataflow.visualize} - for visualization helpers (e.g., rendering the DFG as a mermaid graph),
 * - {@link Dataflow.views} - for working with specific views of the dataflow graph (e.g., the call graph),
 * - {@link Dataflow.edge} - for working with the edges in the dataflow graph,
 * - {@link Dataflow.qualify} - for the package-qualified `pkg::fn` identifier of a call from its id and graph,
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
	 * The qualified identifier of the call with the given id, or `undefined` if it does not resolve to a package
	 * export (with `purrr` loaded, a `map()` call yields `Identifier.make('map', 'purrr')`).
	 *
	 * This is the compact form of {@link Identifier.toQualified}, reconstructing both the
	 * {@link Dataflow.origin|origins} and the call's name from the graph.
	 * @param id           - The id of the call to qualify
	 * @param graph        - The graph the call is part of
	 * @param qualifyBaseR - Whether to also qualify a bare base-R call from the package exporting it
	 *                       (`sd` yields `stats::sd`), which needs neither a loaded database nor graph edges.
	 *                       Set this to `false` to only qualify what the origins resolve to.
	 */
	qualify(this: void, id: NodeId, graph: DataflowGraph, qualifyBaseR = true): Identifier | undefined {
		// only look the vertex up when its name is actually needed (base-R qualification)
		const vertex = qualifyBaseR ? graph.getVertex(id) : undefined;
		return Identifier.toQualified(
			getOriginInDfg(graph, id),
			isFunctionCallVertex(vertex) ? vertex.name : undefined
		);
	},
	/**
	 * Interprocedural propagation of escaped side effects (attached packages, `<<-` definitions) to their callers.
	 */
	sideEffects: {
		propagateTransitive: propagateTransitiveSideEffects,
		callGraphSummaries:  computeCallGraphSummaries,
	},
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
	 * Equivalent to {@link Dataflow.reduceGraph|`reduceGraph`} followed by {@link Dataflow.invertGraph|`invertGraph`}
	 * but in a single pass over the graph, allocating only one intermediate object instead of two.
	 * Use this when you need the reduced-and-inverted graph for a forward traversal within a restriction set.
	 */
	reduceAndInvertGraph<G extends DataflowGraph>(this: void, graph: G, select: ReadonlySet<NodeId>, cleanEnv: REnvironmentInformation): G {
		const df = new DataflowGraph(graph.idMap);
		for(const [id, vtx] of graph.vertices(true)) {
			if(select.has(id)) {
				df.addVertex(vtx, cleanEnv);
			}
		}
		for(const [from, targets] of graph.edges()) {
			if(!select.has(from)) {
				continue;
			}
			for(const [to, { types }] of targets) {
				if(!select.has(to)) {
					continue;
				}
				df.addEdge(to, from, types);
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
	 * @param id          - The id to use as a seed for provenance calculation
	 * @param graph       - The graph to perform the provenance calculation on
	 * @param consider    - The ids to restrict the calculation too (e.g., the ids contained within a function definition to restrict the analysis to)
	 * @param followEdges - Which edges to consider in the provenance traversal, if you set this to undefined this will automatically track all edges
	 * @see {@link Dataflow.provenanceGraph} - for a convenience wrapper to directly obtain the graph of the provenance.
	 */
	provenance(this: void, id: NodeId, graph: DataflowGraph, consider?: ReadonlySet<NodeId>, followEdges: number | undefined = EdgeType.Calls | EdgeType.Reads | EdgeType.Returns | EdgeType.Argument | EdgeType.DefinedBy | EdgeType.DefinedByOnCall): Set<NodeId> {
		const queue = [id];
		const visited = new Set<NodeId>();

		while(queue.length > 0) {
			const nodeId = queue.pop();
			if(nodeId === undefined || visited.has(nodeId) || (consider && !consider.has(nodeId))) {
				continue;
			}
			visited.add(nodeId);
			const vtx = graph.get(nodeId);
			if(vtx === undefined) {
				continue;
			}
			for(const [to, types] of vtx[1]) {
				if(followEdges === undefined || DfEdge.includesType(types, followEdges)) {
					queue.push(to);
				}
			}
			for(const cd of vtx[0].cds ?? []) {
				queue.push(cd.id);
			}
		}
		return visited;
	},
	/**
	 * A simple visitor akin to {@link RNode.visitAst} to traverse the dataflow graph starting from the start id and only
	 * respecting edge direction.
	 * @param graph      - The dataflow graph to operate on.
	 * @param start      - The start id of the visitation.
	 * @param onVertex   - The function to execute for each vertex, if this returns `true` the visitation will stop from this vertex.
	 */
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
	visitDfg(this: void, graph: DataflowGraph, start: NodeId, onVertex: (vtx: DataflowGraphVertexInfo) => (boolean | void)) {
		const queue = [start];
		const visited = new Set<NodeId>();

		while(queue.length > 0) {
			const nodeId = queue.pop();
			if(nodeId === undefined || visited.has(nodeId)) {
				continue;
			}
			visited.add(nodeId);
			const vtx = graph.get(nodeId);
			if(vtx === undefined) {
				continue;
			}
			const shouldStop = onVertex(vtx[0]);
			if(shouldStop) {
				continue;
			}
			for(const [to] of vtx[1]) {
				queue.push(to);
			}
		}
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
