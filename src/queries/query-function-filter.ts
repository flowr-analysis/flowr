import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { SlicingCriterion } from '../slicing/criterion/parse';
import { VertexType } from '../dataflow/graph/vertex';

/** A query that may restrict the functions it inspects to a set of slicing criteria. */
interface FunctionFilteringQuery {
	filter?: readonly SlicingCriterion[]
}

/**
 * Resolves the function filter shared by the inspection queries (`inspect-*`).
 */
export const QueryFunctionFilter = {
	name: 'QueryFunctionFilter',
	/**
	 * Whether the definition is one the analyzed code writes. A deferred expression (`on.exit` and its
	 * relatives) is wrapped in a definition of its own, which carries an id no node of the ast does, and
	 * nobody asks about a function they never wrote.
	 */
	written(this: void, id: NodeId): boolean {
		return typeof NodeId.normalize(id) === 'number';
	},
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
