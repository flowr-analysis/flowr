import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeCallGraphQuery } from './call-graph-query-executor';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import { graphToMermaidUrl } from '../../../util/mermaid/dfg';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { CallGraph } from '../../../dataflow/graph/call-graph';

/**
 * Computes the Call Graph of the analyzed project.
 */
export interface CallGraphQuery extends BaseQueryFormat {
	readonly type: 'call-graph';
}

export interface CallGraphQueryResult extends BaseQueryResult {
	/** Please be aware that this is the graph in its JSON representation, use {@link DataflowGraph#fromJson} if the result is serialized */
	readonly graph: CallGraph;
}

export const CallGraphQueryDefinition = {
	executor:        executeCallGraphQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'call-graph'>['call-graph'];
		result.push(`Query: ${bold('call-graph', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(`   ╰ [Call Graph](${graphToMermaidUrl(out.graph)})`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('call-graph').required().description('The type of the query.'),
	}).description('A query to compute the Call Graph of the analyzed project.'),
	flattenInvolvedNodes: queryResults => {
		const flattened: NodeId[] = [];
		const out = queryResults as QueryResults<'call-graph'>['call-graph'];
		for(const id of out.graph.idMap?.keys() ?? []) {
			flattened.push(id);
		}
		return flattened;
	}
} as const satisfies SupportedQuery<'call-graph'>;
