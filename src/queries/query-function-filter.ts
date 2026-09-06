import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { SlicingCriterion } from '../slicing/criterion/parse';
import { VertexType } from '../dataflow/graph/vertex';
import type { DataflowGraph } from '../dataflow/graph/graph';

/** A query that may restrict the functions it inspects to a set of slicing criteria. */
interface FunctionFilteringQuery {
	filter?: readonly SlicingCriterion[]
}

/**
 * Resolves the function filter shared by the inspection queries (`inspect-*`).
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
		let filters: SlicingCriterion[] | undefined = undefined;
		// filter will remain undefined if at least one of the queries wants all functions
		for(const q of queries) {
			if(q.filter === undefined) {
				filters = undefined;
				break;
			} else {
				filters ??= [];
				filters = filters.concat(q.filter);
			}
		}

		const ast = await analyzer.normalize();

		const filterFor = new Set<NodeId>();
		if(filters) {
			for(const f of filters) {
				const i = SlicingCriterion.tryParse(f, ast.idMap);
				if(i !== undefined) {
					filterFor.add(i);
				}
			}
		}
		return filterFor;
	},
	/**
	 * The definitions of `graph` a query answers for: the ones the analyzed code writes, narrowed to
	 * `filterFor` when it holds anything. One pass, as every inspection query starts with this.
	 */
	definitions(this: void, graph: DataflowGraph, filterFor: ReadonlySet<NodeId>): NodeId[] {
		const found: NodeId[] = [];
		for(const [id] of graph.verticesOfType(VertexType.FunctionDefinition)) {
			if(QueryFunctionFilter.written(id) && (filterFor.size === 0 || filterFor.has(id))) {
				found.push(id);
			}
		}
		return found;
	},
	/** The call graph together with the functions the given queries want to inspect. */
	async inCallGraph(this: void, queries: readonly FunctionFilteringQuery[], analyzer: ReadonlyFlowrAnalysisProvider, onlyDefinitions = true) {
		const filterFor = await QueryFunctionFilter.criteria(queries, analyzer);
		const cg = await analyzer.callGraph();

		let fns = (onlyDefinitions || filterFor.size === 0 ? cg.verticesOfType(VertexType.FunctionDefinition) : cg.vertices(true))
			.filter(([id]) => QueryFunctionFilter.written(id));
		if(filterFor.size > 0) {
			fns = fns.filter(([id]) => filterFor.has(id));
		}
		return { cg, fns };
	}
} as const;
