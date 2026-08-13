import type { InspectHigherOrderQuery, InspectHigherOrderQueryResult } from './inspect-higher-order-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isFunctionHigherOrder } from '../../../dataflow/fn/higher-order-function';
import { VertexType } from '../../../dataflow/graph/vertex';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { QueryFunctionFilter } from '../../query-function-filter';

/**
 * Execute higher-order function inspection queries on the given analyzer.
 */
export async function executeHigherOrderQuery({ analyzer }: BasicQueryData, queries: readonly InspectHigherOrderQuery[]): Promise<InspectHigherOrderQueryResult> {
	const start = Date.now();
	const filterFor = await QueryFunctionFilter.criteria(queries, analyzer);

	const graph = (await analyzer.dataflow()).graph;

	const fns = graph.verticesOfType(VertexType.FunctionDefinition)
		.filter(([,v]) => filterFor.size === 0 || filterFor.has(v.id));

	let invertedGraph: DataflowGraph | undefined;
	if(filterFor.size === 0 || filterFor.size > 10) {
		invertedGraph = Dataflow.invertGraph(graph, analyzer.inspectContext().env.makeCleanEnv());
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
