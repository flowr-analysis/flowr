import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { queryHeader } from '../../query-print';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { log } from '../../../util/log';
import { metaSince } from '../../query-meta';
import { reduceDfg } from '../../../util/simple-df/dfg-view';
import { VertexType } from '../../../dataflow/graph/vertex';
import { escapeRegExp } from '../../../abstract-interpretation/data-frame/arguments';
import { BuiltInOperators } from '../../../dataflow/environments/default-builtin-config/base-operators';

/**
 * The lens hides syntax: every operator R has, the native pipe (which {@link BuiltInOperators.byName} does not list), and the
 * control-flow keywords. None of them names anything, unlike the built-in *functions* (`print`, `ifelse`) it keeps.
 * Anchored and escaped, as most of these are regex syntax themselves and an unanchored alternative would also drop
 * every lexeme merely *containing* one (`if` in `identifier`).
 */
const HiddenLexemes = `^(${
	[...Object.keys(BuiltInOperators.byName), '|>', 'function', 'repeat', 'if', 'next', 'break']
		.map(name => escapeRegExp(name)).join('|')
})$`;

/**
 * Executes the given dataflow lens queries using the provided analyzer.
 */
export async function executeDataflowLensQuery({ analyzer }: BasicQueryData, queries: readonly DataflowLensQuery[]): Promise<DataflowLensQueryResult> {
	if(queries.length !== 1) {
		log.warn('Dataflow query expects only up to one query, but got', queries.length);
	}

	const now = Date.now();
	const simplifiedGraph = reduceDfg((await analyzer.dataflow()).graph, {
		vertices: {
			keepEnv:           false,
			keepCd:            true,
			tags:              [VertexType.Use, VertexType.VariableDefinition, VertexType.FunctionDefinition, VertexType.FunctionCall],
			nameRegex:         HiddenLexemes,
			blacklistWithName: true
		}
	}, analyzer.inspectContext().env.makeCleanEnv());

	return {
		...metaSince(now),
		simplifiedGraph
	};
}

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
