import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { queryHeader } from '../../query-print';
import { executeDataflowLensQuery } from './dataflow-lens-query-executor';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { Dataflow } from '../../../dataflow/graph/df-helper';

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
	title:           'Dataflow Lens Query',
	executor:        executeDataflowLensQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'dataflow-lens'>['dataflow-lens'];
		result.push(queryHeader('dataflow-lens', formatter, out['.meta'].timing));
		result.push(`   ╰ [Simplified Graph](${Dataflow.visualize.mermaid.url(out.simplifiedGraph, false, undefined, true)})`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('dataflow-lens').required().description('The type of the query.'),
	}).description('The dataflow-lens query returns a simplified view on the dataflow graph')
} as const satisfies SupportedQuery<'dataflow-lens'>;
