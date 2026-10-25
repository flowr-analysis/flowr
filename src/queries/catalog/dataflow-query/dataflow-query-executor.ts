import type { DataflowQuery, DataflowQueryResult } from './dataflow-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';

/**
 * Executes the given dataflow queries.
 */
export async function executeDataflowQuery({ analyzer }: BasicQueryData, queries: readonly DataflowQuery[]): Promise<DataflowQueryResult> {
	if(queries.length !== 1) {
		log.warn('Dataflow query expects only up to one query, but got', queries.length);
	}
	const startTime = Date.now();
	const { graph } = await analyzer.dataflow();
	return {
		...metaSince(startTime),
		graph: queries.every(q => q.environments === false) ? graph.withoutEnvironments() : graph
	};
}
