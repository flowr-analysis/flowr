import type { InspectHigherOrderQuery, InspectHigherOrderQueryResult } from './inspect-higher-order-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { QueryFunctionFilter } from '../../query-function-filter';
import { Fn } from '../../../dataflow/fn/fn';


/**
 * Execute higher-order function inspection queries on the given analyzer.
 */
export async function executeHigherOrderQuery({ analyzer }: BasicQueryData, queries: readonly InspectHigherOrderQuery[]): Promise<InspectHigherOrderQueryResult> {
	const start = Date.now();
	const filterFor = await QueryFunctionFilter.criteria(queries, analyzer);

	const graph = (await analyzer.dataflow()).graph;

	const fns = QueryFunctionFilter.definitions(graph, filterFor);

	let invertedGraph: DataflowGraph | undefined;
	if(filterFor.size === 0 || filterFor.size > 10) {
		invertedGraph = Dataflow.invertGraph(graph, analyzer.inspectContext().env.makeCleanEnv());
	}

	const result: Record<NodeId, boolean> = {};
	for(const id of fns) {
		result[id] = Fn.isHigherOrder(id, graph, { ctx: analyzer.inspectContext(), invertedGraph });
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		higherOrder: result
	};
}
