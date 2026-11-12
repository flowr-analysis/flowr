import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import { bold, markdownFormatter } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { DataflowGraphClusters } from '../../../dataflow/cluster';
import { summarizeIdsIfTooLong } from '../../query-print';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { log } from '../../../util/log';
import { findAllClusters } from '../../../dataflow/cluster';
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

export const ClusterQueryDefinition = {
	title:           'Dataflow Cluster Query',
	executor:        executeDataflowClusterQuery,
	asciiSummarizer: async(formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'dataflow-cluster'>['dataflow-cluster'];
		result.push(`Query: ${bold('dataflow-cluster', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		result.push(`   ╰ Found ${out.clusters.length} cluster${out.clusters.length === 1 ? '' : 's'}`);
		for(const cluster of out.clusters) {
			const unknownSideEffects = cluster.hasUnknownSideEffects ? '(has unknown side effect)' : '';
			let suffix = '';
			if(formatter === markdownFormatter) {
				suffix = `([marked](${
					Dataflow.visualize.mermaid.url((await analyzer.dataflow()).graph, false, new Set(cluster.members))
				}))`;
			}
			result.push(`      ╰ ${unknownSideEffects} {${summarizeIdsIfTooLong(formatter, cluster.members)}} ${suffix}`);
		}
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('dataflow-cluster').required().description('The type of the query.'),
	}).description('The cluster query calculates and returns all clusters in the dataflow graph.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'dataflow-cluster'>['dataflow-cluster'];
		return out.clusters.flatMap(({ members }) => members);
	}
} as const satisfies SupportedQuery<'dataflow-cluster'>;
