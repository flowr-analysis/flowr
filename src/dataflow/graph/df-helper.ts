import { DataflowGraph, UnknownSideEffect, type CallQualifier } from './graph';
import { DfEdge, EdgeType } from './edge';
import { emptyGraph } from './dataflowgraph-builder';
import { getOriginInDfg } from '../origin/dfg-get-origin';
import { GraphHelper } from './graph-helper';
import { CallGraph } from './call-graph';
import { computeCallGraphSummaries, propagateTransitiveSideEffects } from '../internal/process/functions/call/built-in/transitive-side-effects';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { DataflowGraphVertexInfo } from './vertex';
import { Vertex } from './vertex';
import { Identifier } from '../environments/identifier';
import { Resolve } from '../environments/resolve-helper';
import { isBaseRPackage } from '../../util/r-base-packages';

/**
 * This is the root helper object to work with the {@link DataflowGraph}.
 *
 * - {@link Dataflow.visualize} - for visualization helpers (e.g., rendering the DFG as a mermaid graph),
 * - {@link Dataflow.qualify}/{@link Dataflow.qualifyAll} - for the package-qualified `pkg::fn` identifier of a call
 * from its id and graph, or of every call of a graph at once,
 * - {@link Dataflow.packagesOf} - for the packages a set of nodes (e.g. a slice) calls into,
 * - {@link Dataflow.valueIsUsed}/{@link Dataflow.hasComputedArguments} - for what a call does with, and gets as, values,
 *
 * What it used to re-expose under a second name is imported directly instead: {@link DfEdge} for the edges,
 * {@link CallGraph} for the call-graph view, {@link Resolve} for name and value resolution, and
 * {@link DataflowGraph} for the graph itself.
 * @example
 * ```ts
 * Dataflow.origin(graph, id);                  // where the use at `id` comes from
 * DfEdge.includesType(edge, EdgeType.Reads);   // the edge helpers
 * Dataflow.visualize.mermaid.url(graph);       // a link to the rendered graph
 * ```
 */
export const Dataflow = {
	...GraphHelper,
	name:   'Dataflow',
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
	 * export and is not itself already namespaced (with `purrr` loaded, a `map()` call yields
	 * `Identifier.make('map', 'purrr')`; an explicit `pkg::fn()` call yields `pkg::fn` unchanged).
	 *
	 * This is the compact form of {@link Identifier.toQualified}, reconstructing both the
	 * {@link Dataflow.origin|origins} and the call's name from the graph.
	 * @param id           - The id of the call to qualify
	 * @param graph        - The graph the call is part of
	 * @param qualifyBaseR - Whether to also qualify a bare base-R call from the package exporting it
	 *                     (`sd` yields `stats::sd`), which needs neither a loaded database nor graph edges.
	 *                     Set this to `false` to only qualify what the origins resolve to (or what is already namespaced).
	 */
	qualify(this: void, id: NodeId, graph: DataflowGraph, qualifyBaseR = true): Identifier | undefined {
		return graph.qualify(id, qualifyBaseR, resolveQualification);
	},
	/**
	 * The qualified name of every call of the graph, `undefined` for the calls that do not qualify.
	 * Prefer this over asking call by call: it resolves each call once for both `qualifyBaseR` variants.
	 * @param graph        - The graph to qualify
	 * @param qualifyBaseR - Which of the two results to return, see {@link Dataflow.qualify}
	 */
	qualifyAll(this: void, graph: DataflowGraph, qualifyBaseR = true): ReadonlyMap<NodeId, Identifier | undefined> {
		return graph.qualifyAll(qualifyBaseR, resolveQualification);
	},
	/**
	 * The packages the given nodes call into, as {@link Dataflow.qualify} resolves every call among them.
	 * This is what a selection needs, which is not what the program loads: a `library()` whose exports the
	 * selection never calls does not make the package needed. Base R is left out unless `includeBaseR`.
	 * @param nodes        - the ids to consider, e.g. the result of a slice
	 * @param graph        - the graph the ids belong to
	 * @param includeBaseR - whether to also report base-R packages
	 */
	packagesOf(this: void, nodes: Iterable<NodeId>, graph: DataflowGraph, includeBaseR = false): Set<string> {
		const packages = new Set<string>();
		for(const id of nodes) {
			if(!Vertex.isFunctionCall(graph.getVertex(id))) {
				continue;
			}
			const qualified = Dataflow.qualify(id, graph, includeBaseR);
			const pkg = qualified === undefined ? undefined : Identifier.getNamespace(qualified);
			if(pkg !== undefined && (includeBaseR || !isBaseRPackage(pkg))) {
				packages.add(pkg);
			}
		}
		return packages;
	},
	/**
	 * Whether the call's result is passed on -- assigned, handed to another call, returned -- rather than left
	 * for R to auto-print. A bare `anova(a, b)` is an output the program reports; the `summary(m)` of
	 * `x <- summary(m)` is not.
	 *
	 * Only an edge that carries the value counts. A plain {@link EdgeType.Reads} does not: it also chains the
	 * calls that share a side effect, which would report `plot(x)` as consumed by the `lines(y)` drawn after it.
	 */
	valueIsUsed(this: void, id: NodeId, graph: DataflowGraph): boolean {
		const consuming = EdgeType.Argument | EdgeType.Returns | EdgeType.DefinedBy;
		for(const [, edge] of graph.edgesTo(id)) {
			if(DfEdge.includesType(edge, consuming)) {
				return true;
			}
		}
		return false;
	},
	/**
	 * Whether any argument of the call carries a value the program worked out, rather than only literals the
	 * author typed: `cat("starting\n")` is a log line, `cat("n =", length(m))` is a finding.
	 * A call among the arguments counts as computed, even one over literals such as `paste("a", "b")`.
	 */
	hasComputedArguments(this: void, id: NodeId, graph: DataflowGraph): boolean {
		for(const [target] of graph.edgesFrom(id)) {
			if(!NodeId.isBuiltIn(target) && !Vertex.isValue(graph.getVertex(target))) {
				return true;
			}
		}
		return false;
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
			const id = UnknownSideEffect.id(u);
			if(select.has(id)) {
				df.markIdForUnknownSideEffects(id, UnknownSideEffect.linkTo(u));
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
			const id = UnknownSideEffect.id(u);
			if(select.has(id)) {
				df.markIdForUnknownSideEffects(id, UnknownSideEffect.linkTo(u));
			}
		}
		return df as G;
	},

	/** See {@link DataflowGraph#isQuoted}, which this answers for `graph`. */
	isQuoted(this: void, id: NodeId, graph: DataflowGraph, withOutgoing = false): boolean {
		return graph.isQuoted(id, withOutgoing);
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
	 * @param graph    - The dataflow graph to operate on.
	 * @param start    - The start id of the visitation.
	 * @param onVertex - The function to execute for each vertex, if this returns `true` the visitation will stop from this vertex.
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

/** both qualifications of a call from a single origin resolution, as the base-R step only adds to what the origins gave */
const resolveQualification: CallQualifier = (graph, id, vertex) => {
	const origins = getOriginInDfg(graph, id);
	const name = Vertex.isFunctionCall(vertex) ? vertex.name : undefined;
	const bare = Identifier.toQualified(origins, name, false);
	return [bare, bare ?? Identifier.toQualified(origins, name, true)];
};
