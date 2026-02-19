import type { DataflowQuery, DataflowQueryResult } from './dataflow-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';

/**
 * Executes the given dataflow queries.
 */
export async function executeDataflowQuery({ analyzer }: BasicQueryData, queries: readonly DataflowQuery[]): Promise<DataflowQueryResult> {
	if(queries.length !== 1) {
		log.warn('Dataflow query expects only up to one query, but got', queries.length);
	}
	const startTime = Date.now();
	const graph = (await analyzer.dataflow()).graph;
	return {
		'.meta': {
			timing: Date.now() - startTime
		},
		graph
	};
}
