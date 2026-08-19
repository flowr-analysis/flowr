import type {
	InspectExceptionQuery, InspectExceptionQueryResult
} from './inspect-exception-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ExceptionPoint } from '../../../dataflow/fn/exceptions-of-function';
import { QueryFunctionFilter } from '../../query-function-filter';
import { calculateExceptionsOfFunction } from '../../../dataflow/fn/exceptions-of-function';

/**
 * Execute exception function inspection queries on the given analyzer.
 */
export async function executeExceptionQuery({ analyzer }: BasicQueryData, queries: readonly InspectExceptionQuery[]): Promise<InspectExceptionQueryResult> {
	const start = Date.now();
	const { cg, fns } = await QueryFunctionFilter.inCallGraph(queries, analyzer);
	const result: Record<NodeId, ExceptionPoint[]> = {};

	for(const [id] of fns) {
		if(result[id]) {
			continue;
		}
		const res = calculateExceptionsOfFunction(id, cg, result);
		for(const [k, v] of Object.entries(res) as [NodeId, ExceptionPoint[]][]) {
			if(!result[k]) {
				result[k] = v;
			}
		}
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		/* collecting walks whatever the call graph holds, reporting stays with the definitions someone wrote */
		exceptions: Object.fromEntries(Object.entries(result).filter(([id]) => QueryFunctionFilter.written(id)))
	};
}
