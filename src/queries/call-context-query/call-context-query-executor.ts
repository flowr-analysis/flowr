import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { CallContextQueryFormat , CallContextQueryResult } from './call-context-query-format';

export function executeCallContextQuery(graph: DataflowGraph, query: CallContextQueryFormat): CallContextQueryResult {
	console.log('hey');
	return null as unknown as CallContextQueryResult;
}
