import { log } from '../../../util/log';
import type { DataflowClusterQuery, DataflowClusterQueryResult } from './cluster-query-format';
import { findAllClusters } from '../../../dataflow/cluster';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';

/**
 * Executes the given dataflow cluster queries using the provided analyzer.
 */
export async function executeDataflowClusterQuery({ analyzer }: BasicQueryData, queries: readonly DataflowClusterQuery[]): Promise<DataflowClusterQueryResult> {
	if(queries.length !== 1) {
		log.warn('The dataflow cluster query expects only up to one query, but got', queries.length);
	}

	const start = Date.now();
	const clusters = findAllClusters((await analyzer.dataflow()).graph);
	return {
		...metaSince(start),
		clusters
	};
}
