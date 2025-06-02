import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { executeDataflowQuery } from './dataflow-query-executor';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import { graphToMermaidUrl } from '../../../util/mermaid/dfg';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

/**
 * Simple re-returns the dataflow graph of the analysis.
 */
export interface DataflowQuery extends BaseQueryFormat {
	readonly type: 'dataflow';
}

export interface DataflowQueryResult extends BaseQueryResult {
	/** Please be aware that this is the graph in its JSON representation, use {@link DataflowGraph#fromJson} if the result is serialized */
	readonly graph: DataflowGraph;
}

export const DataflowQueryDefinition = {
	executor:        executeDataflowQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'dataflow'>['dataflow'];
		result.push(`Query: ${bold('dataflow', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(`   ╰ [Dataflow Graph](${graphToMermaidUrl(out.graph)})`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('dataflow').required().description('The type of the query.'),
	}).description('The dataflow query simply returns the dataflow graph, there is no need to pass it multiple times!'),
	flattenInvolvedNodes: queryResults => {
		const flattened: NodeId[] = [];
		const out = queryResults as QueryResults<'dataflow'>['dataflow'];
		for(const id of out.graph.idMap?.keys() ?? []) {
			flattened.push(id);
		}
		return flattened;
	}
} as const satisfies SupportedQuery<'dataflow'>;
