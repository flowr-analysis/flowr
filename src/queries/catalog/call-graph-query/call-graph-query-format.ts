import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { executeCallGraphQuery } from './call-graph-query-executor';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { CallGraph } from '../../../dataflow/call-graph/call-graph';

/**
 * Calculates and returns the call graph view of the DFG
 */
export interface CallGraphQuery extends BaseQueryFormat {
	readonly type: 'call-graph';
}


export interface CallGraphQueryResult extends BaseQueryResult {
	readonly cg: CallGraph;
}

export const CallGraphQueryDefinition = {
	executor:        executeCallGraphQuery,
	asciiSummarizer: (formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'call-graph'>['call-graph'];
		result.push(`Query: ${bold('call-graph', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		result.push('   ╰ TODO TODO TODO');

		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('call-graph').required().description('The type of the query.'),
	}).description('The cluster query calculates and returns the call graph view of the dataflow graph.'),
	flattenInvolvedNodes: (_queryResults: BaseQueryResult): NodeId[] => {
		return []; // TODO
	}
} as const satisfies SupportedQuery<'call-graph'>;
