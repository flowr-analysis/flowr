import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeCallGraphQuery } from './call-graph-query-executor';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { CallGraph } from '../../../dataflow/graph/call-graph';

/**
 * Computes the Call Graph of the analyzed project.
 */
export interface CallGraphQuery extends BaseQueryFormat {
	readonly type:                    'call-graph';
	/**
	 * If set, expand library/built-in leaf calls into their internal callees using the signature database's
	 * `transitiveCallees` (a no-op if no signature database is loaded). Default false.
	 */
	readonly expandLibraryInternals?: boolean;
	/** If set, also report the calls top-level execution never reaches. Default false. */
	readonly reportUnreachable?:      boolean;
	/** 
	 * Only keep calls that match all of the given criteria. Criteria of form x means:  Any of the arguments depend on a function call that matches to the regex x. Criteria of form [x, y] means: Any argument that matches regex x must depend on a function call that matches the regex y.
	*/
	readonly reliesOnCriteria?:              (string | [string, string])[];
}

export interface CallGraphQueryResult extends BaseQueryResult {
	/** Please be aware that this is the graph in its JSON representation, use {@link DataflowGraph#fromJson} if the result is serialized */
	readonly graph:        CallGraph;
	/** the calls no top-level execution reaches, only present if {@link CallGraphQuery#reportUnreachable} was set */
	readonly unreachable?: readonly NodeId[];
}

export const CallGraphQueryDefinition = {
	title:           'Call-Graph Query',
	executor:        executeCallGraphQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'call-graph'>['call-graph'];
		result.push(`Query: ${bold('call-graph', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(`   ╰ [Call Graph](${CallGraph.visualize.mermaid.url(out.graph)})`);
		if(out.unreachable !== undefined) {
			result.push(`   ╰ Unreachable calls: {${out.unreachable.join(', ')}}`);
		}
		return true;
	},
	schema: Joi.object({
		type:                   Joi.string().valid('call-graph').required().description('The type of the query.'),
		expandLibraryInternals: Joi.boolean().optional().description('Expand library/built-in leaf calls into their internal callees via the signature database (default false).'),
		reliesOnCriteria:       Joi.optional(),
		reportUnreachable:      Joi.boolean().optional().description('Also report the calls that top-level execution never reaches (default false).'),
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
