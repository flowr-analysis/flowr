import type { InspectRecursionQuery, InspectRecursionQueryResult } from './inspect-recursion-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isFunctionRecursive } from '../../../dataflow/fn/recursive-function';
import { getFunctionsToConsiderInCallGraph } from '../inspect-exceptions-query/inspect-exception-query-executor';

/**
 * Execute recursion function inspection queries on the given analyzer.
 */
export async function executeRecursionQuery({ analyzer }: BasicQueryData, queries: readonly InspectRecursionQuery[]): Promise<InspectRecursionQueryResult> {
	const start = Date.now();
	const { cg, fns } = await getFunctionsToConsiderInCallGraph(queries, analyzer);

	const result: Record<NodeId, boolean> = {};
	for(const [id,] of fns) {
		result[id] = isFunctionRecursive(id, cg);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		recursive: result
	};
}
