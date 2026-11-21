import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { SlicingCriterion } from '../slicing/criterion/parse';
import { VertexType } from '../dataflow/graph/vertex';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { isNotUndefined } from '../util/assert';

/** A query that may restrict the functions it inspects to a set of slicing criteria. */
interface FunctionFilteringQuery {
	filter?: readonly SlicingCriterion[]
}

/**
 * Resolves the function filter shared by the inspection queries (`inspect-*`).
 * @helper api
 */
export const QueryFunctionFilter = {
	name:    'QueryFunctionFilter',
	/**
	 * Whether the definition is one the analyzed code writes, as nobody asks about a function they never wrote.
	 * @see {@link NodeId.isWritten}
	 */
	written: NodeId.isWritten,
	/** The ids the given queries restrict themselves to; empty if at least one query wants all functions. */
	async criteria(this: void, queries: readonly FunctionFilteringQuery[], analyzer: ReadonlyFlowrAnalysisProvider): Promise<ReadonlySet<NodeId>> {
		const ast = await analyzer.normalize();
		if(queries.some(q => q.filter === undefined)) {
			return new Set();
		}
		return new Set(queries.flatMap(q => q.filter ?? []).map(f => SlicingCriterion.tryParse(f, ast.idMap)).filter(isNotUndefined));
	},
	/**
	 * The definitions of `graph` a query answers for: the ones the analyzed code writes, narrowed to
	 * `filterFor` when it holds anything. One pass, as every inspection query starts with this.
	 */
	definitions(this: void, graph: DataflowGraph, filterFor: ReadonlySet<NodeId>): NodeId[] {
		return graph.vertexIdsOfType(VertexType.FunctionDefinition).filter(id => QueryFunctionFilter.written(id) && (filterFor.size === 0 || filterFor.has(id)));
	},
	/** The call graph together with the functions the given queries want to inspect. */
	async inCallGraph(this: void, queries: readonly FunctionFilteringQuery[], analyzer: ReadonlyFlowrAnalysisProvider, onlyDefinitions = true) {
		const filterFor = await QueryFunctionFilter.criteria(queries, analyzer);
		const cg = await analyzer.callGraph();

		const fns = (onlyDefinitions || filterFor.size === 0 ? cg.verticesOfType(VertexType.FunctionDefinition) : cg.vertices(true))
			.filter(([id]) => QueryFunctionFilter.written(id) && (filterFor.size === 0 || filterFor.has(id)));
		return { cg, fns };
	}
} as const;
