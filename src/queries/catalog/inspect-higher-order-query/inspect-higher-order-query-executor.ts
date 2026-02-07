import type { InspectHigherOrderQuery, InspectHigherOrderQueryResult } from './inspect-higher-order-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isFunctionHigherOrder } from '../../../dataflow/fn/higher-order-function';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { tryResolveSliceCriterionToId } from '../../../slicing/criterion/parse';
import { VertexType } from '../../../dataflow/graph/vertex';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { invertDfg } from '../../../dataflow/graph/invert-dfg';

/**
 * Execute higher-order function inspection queries on the given analyzer.
 */
export async function executeHigherOrderQuery({ analyzer }: BasicQueryData, queries: readonly InspectHigherOrderQuery[]): Promise<InspectHigherOrderQueryResult> {
	const start = Date.now();
	let filters: SingleSlicingCriterion[] | undefined = undefined;
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
			const i = tryResolveSliceCriterionToId(f, ast.idMap);
			if(i !== undefined) {
				filterFor.add(i);
			}
		}
	}

	const graph = (await analyzer.dataflow()).graph;

	const fns = graph.verticesOfType(VertexType.FunctionDefinition)
		.filter(([,v]) => filterFor.size === 0 || filterFor.has(v.id));

	let invertedGraph: DataflowGraph | undefined;
	if(filterFor.size === 0 || filterFor.size > 10) {
		invertedGraph = invertDfg(graph, analyzer.inspectContext().env.makeCleanEnv());
	}

	const result: Record<NodeId, boolean> = {};
	for(const [id] of fns) {
		result[id] = isFunctionHigherOrder(id, graph, analyzer.inspectContext(), invertedGraph);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		higherOrder: result
	};
}
