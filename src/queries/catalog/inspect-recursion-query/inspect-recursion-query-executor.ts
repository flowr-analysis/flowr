import type { InspectRecursionQuery } from './inspect-recursion-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { CallGraph } from '../../../dataflow/graph/call-graph';
import { QueryFunctionFilter } from '../../query-function-filter';

/**
 * Execute recursion function inspection queries on the given analyzer.
 */
export async function executeRecursionQuery({ analyzer }: BasicQueryData, queries: readonly InspectRecursionQuery[]): Promise<Record<NodeId, boolean>> {
	const { cg, fns } = await QueryFunctionFilter.inCallGraph(queries, analyzer);

	const result: Record<NodeId, boolean> = {};
	for(const [id] of fns) {
		result[id] = CallGraph.isRecursive(id, cg);
	}

	return result;
}
