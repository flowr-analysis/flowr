import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { CallContextQuery , CallContextQueryResult } from './call-context-query-format';

/* TODO: Group all names etc. together to traverse only once */

/**
 * Multi-stage call context query resolve.
 *
 * 1. Resolve all calls in the DF graph that match the respective {@link DefaultCallContextQueryFormat#callName} regex.
 *    This includes any function calls to be collected for 'linkTo' resolutions.
 * 2. Identify their respective call targets, if {@link DefaultCallContextQueryFormat#callTargets} is set to be non-any.
 * 3. Attach `linkTo` calls to the respective calls.
 */
export function executeCallContextQueries(graph: DataflowGraph, queries: readonly CallContextQuery[]): CallContextQueryResult {

	return {
		queryType: 'call-context',
		kinds:     {}
	};
}
