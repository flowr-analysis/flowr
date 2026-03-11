import { DataflowGraph } from './graph';
import { DfEdge } from './edge';
import type { REnvironmentInformation } from '../environments/environment';
import type { NamedGraph } from '../../util/diff-graph';
import { GraphDifferenceReport, initDiffContext } from '../../util/diff-graph';
import type { GenericDiffConfiguration } from '../../util/diff';
import { diffDataflowGraph } from './diff-dataflow-graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { guard } from '../../util/assert';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { SingleSlicingCriterion } from '../../slicing/criterion/parse';

/**
 * This is the root helper object to work with the {@link DataflowGraph}.
 */
export const Dataflow = {
	/**
	 * Maps to flowR's main graph object to store and manipulate the dataflow graph
	 * @see {@link DataflowGraph}
	 */
	graph: DataflowGraph,
	/**
	 * Maps to flowR's dataflow edge helper to work with the edges in the dataflow graph
	 */
	edge:  DfEdge,
	/**
	 * Compare two dataflow graphs and return a report on the differences.
	 * If you simply want to check whether they equal, use {@link GraphDifferenceReport#isEqual|`<result>.isEqual()`}.
	 * @see {@link diffOfControlFlowGraphs} - for control flow graphs
	 */
	diff(this: void, left: NamedGraph, right: NamedGraph, config?: Partial<GenericDiffConfiguration>): GraphDifferenceReport {
		if(left.graph === right.graph) {
			return new GraphDifferenceReport();
		}
		const ctx = initDiffContext(left, right, config);
		diffDataflowGraph(ctx);
		return ctx.report;
	},
	/**
	 * Inverts the given dataflow graph by reversing all edges.
	 */
	invert(this: void, graph: DataflowGraph, cleanEnv: REnvironmentInformation): DataflowGraph {
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
	},
	/**
	 * Resolves the dataflow graph ids from slicing criterion form to ids.
	 * This returns a **new** graph with the resolved ids.
	 * The main use-case for this is testing - if you do not know/want to fix the specific id,
	 * you can use, e.g. `2@x` as a placeholder for the first x in the second line!
	 */
	resolve(graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, idMap?: AstIdMap): DataflowGraph {
		const resolveMap = idMap ?? graph.idMap;
		guard(resolveMap !== undefined, 'idMap must be provided to resolve the graph');

		const cache = new Map<string, NodeId>();

		const resolve = (id: string | NodeId): NodeId => {
			const cached = cache.get(id as string);
			if(cached !== undefined) {
				return cached;
			}
			const resolved = SingleSlicingCriterion.tryParse(id, resolveMap) ?? id as NodeId;

			cache.set(id as string, resolved);
			return resolved;
		};

		const resultGraph = new DataflowGraph(resolveMap);
		const roots = graph.rootIds();

		/* recreate vertices */
		for(const [id, vertex] of graph.vertices(true)) {
			resultGraph.addVertex({
				...vertex,
				id: resolve(id as string)
			}, ctx.env.makeCleanEnv(), roots.has(id));
		}
		/* recreate edges */
		for(const [from, targets] of graph.edges()) {
			for(const [to, info] of targets) {
				for(const type of DfEdge.splitTypes(info)) {
					resultGraph.addEdge(
						resolve(from),
						resolve(to),
						type
					);
				}
			}
		}

		for(const unknown of graph.unknownSideEffects) {
			if(typeof unknown === 'object') {
				resultGraph.markIdForUnknownSideEffects(resolve(unknown.id), unknown.linkTo);
			} else {
				resultGraph.markIdForUnknownSideEffects(resolve(unknown));
			}
		}

		return resultGraph;
	}
} as const;

// TODO: helper for unknown helpers
// TODO: call graph
// TODO: mermaid helper
// TODO: quads helper
// TODO: vertex helper
// TODO: then do provenance
// TODO: document