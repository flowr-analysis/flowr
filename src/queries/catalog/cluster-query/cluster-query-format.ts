import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold, markdownFormatter } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { DataflowGraphClusters } from '../../../dataflow/cluster';
import { executeDataflowClusterQuery } from './cluster-query-executor';
import { graphToMermaidUrl } from '../../../util/mermaid/dfg';
import { summarizeIdsIfTooLong } from '../../query-print';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

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
					graphToMermaidUrl((await analyzer.dataflow()).graph, false, new Set(cluster.members))
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
