import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { queryHeader } from '../../query-print';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { log } from '../../../util/log';
import { metaSince } from '../../query-meta';

/**
 * Executes the given dataflow queries.
 */
export async function executeDataflowQuery({ analyzer }: BasicQueryData, queries: readonly DataflowQuery[]): Promise<DataflowQueryResult> {
	if(queries.length !== 1) {
		log.warn('Dataflow query expects only up to one query, but got', queries.length);
	}
	const startTime = Date.now();
	const { graph } = await analyzer.dataflow();
	return {
		...metaSince(startTime),
		graph: queries.every(q => q.environments === false) ? graph.withoutEnvironments() : graph
	};
}

/** Above this many characters, the mermaid.live link is dropped from the REPL output (large graphs produce megabyte-sized base64 urls). */
const MaxMermaidUrlLength = 8000;

/**
 * Simple re-returns the dataflow graph of the analysis.
 */
export interface DataflowQuery extends BaseQueryFormat {
	readonly type:          'dataflow';
	/** Whether to include the environments of the vertices and function definitions (default), see {@link DataflowGraph#withoutEnvironments}. */
	readonly environments?: boolean;
}

export interface DataflowQueryResult extends BaseQueryResult {
	/** Please be aware that this is the graph in its JSON representation, use {@link DataflowGraph#fromJson} if the result is serialized */
	readonly graph: DataflowGraph;
}

export const DataflowQueryDefinition = {
	title:           'Dataflow Query',
	executor:        executeDataflowQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'dataflow'>['dataflow'];
		result.push(queryHeader('dataflow', formatter, out['.meta'].timing));
		const url = Dataflow.visualize.mermaid.url(out.graph);
		if(url.length <= MaxMermaidUrlLength) {
			result.push(`   ╰ [Dataflow Graph](${url})`);
		} else {
			const vertices = out.graph.vertices(true).toArray().length;
			const edges = Array.from(out.graph.edges()).length;
			result.push(`   ╰ Dataflow Graph too large to link (${vertices} vertices, ${edges} edges, url would be ${url.length} chars); use ':df#' for more detail.`);
		}
		return true;
	},
	schema: Joi.object({
		type:         Joi.string().valid('dataflow').required().description('The type of the query.'),
		environments: Joi.boolean().optional().description('Whether to include the environments of the vertices and function definitions (default: true). They make up most of the answer, so leave them out if only the graph itself is of interest.'),
	}).description('The dataflow query simply returns the dataflow graph, there is no need to pass it multiple times!'),
	flattenInvolvedNodes: (queryResults): NodeId[] => {
		const out = queryResults as QueryResults<'dataflow'>['dataflow'];
		return [...out.graph.idMap?.keys() ?? []];
	}
} as const satisfies SupportedQuery<'dataflow'>;
