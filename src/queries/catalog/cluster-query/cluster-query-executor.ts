import { log } from '../../../util/log';
import type { DataflowClusterQuery, DataflowClusterQueryResult } from './cluster-query-format';
import { findAllClusters } from '../../../dataflow/cluster';
import type { BasicQueryData } from '../../base-query-format';


/**
 *
 */
export async function executeDataflowClusterQuery({ analyzer }: BasicQueryData, queries: readonly DataflowClusterQuery[]): Promise<DataflowClusterQueryResult> {
	if(queries.length !== 1) {
		log.warn('The dataflow cluster query expects only up to one query, but got', queries.length);
	}

	const start = Date.now();
	const clusters = findAllClusters((await analyzer.dataflow()).graph);
	return {
		'.meta': {
			timing: Date.now() - start
		},
		clusters
	};
}
