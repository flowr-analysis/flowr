import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold, ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { InputClassifierConfig, InputSources } from './simple-input-classifier';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import { executeInputSourcesQuery } from './input-sources-query-executor';
import { SourceLocation } from '../../../util/range';

export type InputSourcesQueryConfig = InputClassifierConfig;
/**
 * Calculates provenance for all inputs and their transformations
 * based on the `provenance` of a given function.
 */
export interface InputSourcesQuery extends BaseQueryFormat {
	readonly type:      'input-sources';
	/**
	 * This takes a criterion (or a numerical id works too)
	 * {@link SlicingCriterion.fromId}
	 */
	readonly criterion: SlicingCriterion,
	readonly config?:   InputSourcesQueryConfig
}

export interface InputSourcesQueryResult extends BaseQueryResult {
	/** For each query key, a list of classified input sources (each with id and all traces) */
	results: Record<string, InputSources>
}

function inputSourcesQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'input-sources'> {
	const criterion = sliceCriteriaParser(line[0]);
	if(!criterion || criterion.length !== 1) {
		output.stderr(output.formatter.format('Invalid provenance query format, a single slicing criterion must be given in the form "(criterion1)"',
			{ color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}

	return { query: [{
		type:      'input-sources',
		criterion: criterion[0],
	}], rCode: line[1] } ;
}

export const InputSourcesDefinition = {
	executor:        executeInputSourcesQuery,
	asciiSummarizer: async(formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'input-sources'>['input-sources'];
		result.push(`Query: ${bold('input-sources', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		const nast = (await analyzer.normalize()).idMap;
		for(const [key, sources] of Object.entries(out.results)) {
			result.push(`   ╰ Input Sources for ${key}`);
			for(const { id, trace, type } of sources) {
				const kNode = nast.get(id);
				const kLoc = kNode ? SourceLocation.format(SourceLocation.fromNode(kNode)) : 'unknown location';
				result.push(
					`           ╰ ${kLoc} (id: ${id}), type: ${JSON.stringify(type)}, trace: ${trace}`
				);
			}
		}
		return true;
	},
	fromLine: inputSourcesQueryLineParser,
	schema:   Joi.object({
		type:      Joi.string().valid('input-sources').required().description('The type of the query.'),
		criterion: Joi.string().required().description('The slicing criterion to use.'),
		config:    Joi.object({
			networkFunctions:      Joi.array().items(Joi.string()).optional().description('Functions that fetch data from the network.'),
			randomnessConsumers:   Joi.array().items(Joi.string()).optional().description('Functions that consume randomness.'),
			randomnessProducers:   Joi.array().items(Joi.object({ type: Joi.string().valid('function', 'assignment'), name: Joi.string().required() })).optional().description('Functions or assignments that produce randomness seeds.'),
			configurableFunctions: Joi.array().items(Joi.string()).optional().description('Functions that read configuration (options/env).'),
			pureFunctions:         Joi.array().items(Joi.string()).optional().description('Deterministic functions that keep constant inputs constant.'),
		}).optional()
	}).description('Input Sources query definition'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult) => {
		const flattened: NodeId[] = [];
		const out = queryResults as QueryResults<'input-sources'>['input-sources'];
		for(const obj of Object.values(out.results)) {
			for(const e of obj) {
				flattened.push(e.id);
			}
		}
		return flattened;
	}
} as const satisfies SupportedQuery<'input-sources'>;
