import type { CallGraphQuery, CallGraphQueryResult } from './call-graph-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince, warnUnlessSingleQuery } from '../../query-meta';
import { expandCallGraphLibraryInternals } from './expand-library-internals';
import { CallGraph } from '../../../dataflow/graph/call-graph';

/**
 * Executes the given call graph queries.
 */
export async function executeCallGraphQuery({ analyzer }: BasicQueryData, queries: readonly CallGraphQuery[]): Promise<CallGraphQueryResult> {
	warnUnlessSingleQuery('Call Graph', queries);
	const startTime = Date.now();
	const graph = await analyzer.callGraph();
	const expand = queries.some(q => q.expandLibraryInternals);
	return {
		...metaSince(startTime),
		graph:       expand ? expandCallGraphLibraryInternals(graph, analyzer.inspectContext().deps) : graph,
		unreachable: queries.some(q => q.reportUnreachable) ? CallGraph.unreachableCalls(graph) : undefined
	};
}
