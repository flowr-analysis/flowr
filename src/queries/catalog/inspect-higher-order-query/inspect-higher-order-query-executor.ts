import type { InspectHigherOrderQuery, InspectHigherOrderQueryResult } from './inspect-higher-order-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isFunctionHigherOrder } from '../../../dataflow/fn/higher-order-function';
import { getFunctionsToConsiderInCallGraph } from '../inspect-exceptions-query/inspect-exception-query-executor';

/**
 * Execute higher-order function inspection queries on the given analyzer.
 */
export async function executeHigherOrderQuery({ analyzer }: BasicQueryData, queries: readonly InspectHigherOrderQuery[]): Promise<InspectHigherOrderQueryResult> {
	const start = Date.now();
	const { cg, fns } = await getFunctionsToConsiderInCallGraph(queries, analyzer);

	const result: Record<NodeId, boolean> = {};
	for(const [id,] of fns) {
		result[id] = isFunctionHigherOrder(id, cg, analyzer.inspectContext());
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		higherOrder: result
	};
}
