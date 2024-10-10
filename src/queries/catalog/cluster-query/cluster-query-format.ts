import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import {DataflowGraphClusters} from "../../../dataflow/cluster";

/**
 * Calculates and returns all clusters encountered in the dataflow graph.
 */
export interface DataflowClusterQuery extends BaseQueryFormat {
	readonly type: 'dataflow-cluster';
}

export interface DataflowClusterQueryResult extends BaseQueryResult {
	/** All clusters found in the respective dataflow */
	readonly clusters: DataflowGraphClusters;
}
