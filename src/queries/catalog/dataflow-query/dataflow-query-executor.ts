import type { BasicQueryData } from '../../query';
import type { DataflowQuery, DataflowQueryResult } from './dataflow-query-format';
import { log } from '../../../util/log';


export function executeDataflowQuery({ graph }: BasicQueryData, queries: readonly DataflowQuery[]): DataflowQueryResult {
	if(queries.length !== 1) {
		log.warn('Dataflow query expects only up to one query, but got', queries.length);
	}
	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		graph
	};
}
