import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { executeDataflowLensQuery } from './dataflow-lens-query-executor';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import { graphToMermaidUrl } from '../../../util/mermaid/dfg';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';

/**
 * Returns a simplified view on the dataflow graph of the analysis
 */
export interface DataflowLensQuery extends BaseQueryFormat {
	readonly type: 'dataflow-lens';
}

export interface DataflowLensQueryResult extends BaseQueryResult {
	/** This is the simplified dataflow graph */
	readonly simplifiedGraph: DataflowGraph;
}

export const DataflowLensQueryDefinition = {
	executor:        executeDataflowLensQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'dataflow-lens'>['dataflow-lens'];
		result.push(`Query: ${bold('dataflow-lens', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(`   ╰ [Simplified Graph](${graphToMermaidUrl(out.simplifiedGraph, false, undefined, true)})`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('dataflow-lens').required().description('The type of the query.'),
	}).description('The dataflow-lens query returns a simplified view on the dataflow graph'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'dataflow-lens'>;
