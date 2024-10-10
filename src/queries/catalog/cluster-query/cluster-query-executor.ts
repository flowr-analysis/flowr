import type { BasicQueryData } from '../../query';
import { log } from '../../../util/log';
import {DataflowClusterQuery, DataflowClusterQueryResult} from "./cluster-query-format";
import {findAllClusters} from "../../../dataflow/cluster";


export function executeDataflowClusterQuery({ graph }: BasicQueryData, queries: readonly DataflowClusterQuery[]): DataflowClusterQueryResult {
	if(queries.length !== 1) {
		log.warn('The dataflow cluster query expects only up to one query, but got', queries.length);
	}

	/* TODO: tests*/
	const start = Date.now();
	const clusters = findAllClusters(graph);
	return {
		'.meta': {
			timing: Date.now() - start
		},
		clusters
	};
}
