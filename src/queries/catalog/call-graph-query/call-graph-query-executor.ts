import type { CallGraphQuery, CallGraphQueryResult } from './call-graph-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';

/**
 * Executes the given call graph queries.
 */
export async function executeCallGraphQuery({ analyzer }: BasicQueryData, queries: readonly CallGraphQuery[]): Promise<CallGraphQueryResult> {
	if(queries.length !== 1) {
		log.warn('Call Graph query expects only up to one query, but got', queries.length);
	}
	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		graph: await analyzer.callGraph()
	};
}
