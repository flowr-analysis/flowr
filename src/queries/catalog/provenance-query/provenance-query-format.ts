import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold, ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import { executeProvenanceQuery } from './provenance-query-executor';
import { Dataflow } from '../../../dataflow/graph/df-helper';

/** Calculates the provenance starting from a given criterion */
export interface ProvenanceQuery extends BaseQueryFormat {
	readonly type:          'provenance';
	/** The slicing criterion to use as a start*/
	readonly criterion:     SlicingCriterion,
	/** Whether to stop on fdef boundaries */
	readonly restrictFdef?: boolean;
}

export interface ProvenanceQueryResult extends BaseQueryResult {
	/**
	 * Maps the requested criteria to the returned ids
	 */
	results: Record<string, NodeId[]>
}
/**
 * Checks whether the given argument represents a fdef boundary with an `f` suffix.
 */
export function fdefBoundaryParser(argument: string): boolean {
	const endBracket = argument.indexOf(')');
	return argument[endBracket + 1] === 'f';
}

function provenanceQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'provenance'> {
	const criterion = sliceCriteriaParser(line[0]);
	const stopFdef = fdefBoundaryParser(line[0]);
	if(!criterion || criterion.length !== 1) {
		output.stderr(output.formatter.format('Invalid provenance query format, a single slicing criterion must be given in the form "(criterion1)"',
			{ color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}

	return { query: [{
		type:         'provenance',
		criterion:    criterion[0],
		restrictFdef: stopFdef
	}], rCode: line[1] } ;
}

export const ProvenanceQueryDefinition = {
	executor:        executeProvenanceQuery,
	asciiSummarizer: async(formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'provenance'>['provenance'];
		const df = await analyzer.dataflow();
		result.push(`Query: ${bold('provenance', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [key, obj] of Object.entries(out.results)) {
			result.push(`   ╰ Provenance for ${key}`);
			const dfg = Dataflow.reduceGraph(df.graph, new Set(obj));
			result.push(`     ╰ [Mermaid Url](${Dataflow.visualize.mermaid.url(dfg)})`);
		}
		return true;
	},
	fromLine: provenanceQueryLineParser,
	schema:   Joi.object({
		type:         Joi.string().valid('provenance').required().description('The type of the query.'),
		criterion:    Joi.string().required().description('The slicing criterion to use.'),
		restrictFdef: Joi.boolean().required().description('Whether to stop on fdef boundaries.')
	}).description('Provenance query definition'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult) => {
		const flattened: NodeId[] = [];
		const out = queryResults as QueryResults<'provenance'>['provenance'];
		for(const obj of Object.values(out.results)) {
			flattened.push(...obj);
		}
		return flattened;
	}
} as const satisfies SupportedQuery<'provenance'>;
