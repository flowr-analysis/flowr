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
import { executeInputSourcesQuery } from './input-sources-query-executor';

export type InputSourceCategory = 'constant' | 'derivedConstant' | 'controlDependent' | 'parameter' | 'network' | 'randomness' | 'configurable' | 'other';
export type InputSourceBuckets = Record<InputSourceCategory, NodeId[]>;

export interface InputSourcesQueryConfig {
	readonly networkFunctions?:      string[];
	readonly randomnessConsumers?:   string[];
	readonly randomnessProducers?:   { type: 'function' | 'assignment', name: string }[];
	readonly configurableFunctions?: string[];
	/**
	 * Functions that are considered deterministic and therefore keep constant inputs constant.
	 */
	readonly pureFunctions?:         string[];
}

/**
 * Calculates provenance for all inputs and their transformations
 * based on the `provenance` of a given function.
 */
export interface InputSourcesQuery extends BaseQueryFormat {
	readonly type:      'input-sources';
	readonly criterion: SlicingCriterion,
	readonly config?:   InputSourcesQueryConfig
}

export interface InputSourcesQueryResult extends BaseQueryResult {
	results: Record<string, InputSourceBuckets>
}

function inputSourcesueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'input-sources'> {
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
	asciiSummarizer: (formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'input-sources'>['input-sources'];
		result.push(`Query: ${bold('input-sources', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [key, obj] of Object.entries(out.results)) {
			result.push(`   ╰ Input Sources for ${key}`);
			// TODO:
			console.log(obj);
		}
		return true;
	},
	fromLine: inputSourcesueryLineParser,
	schema:   Joi.object({
		// TODO
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
			for(const ids of Object.values(obj)) {
				flattened.push(...ids);
			}
		}
		return flattened;
	}
} as const satisfies SupportedQuery<'input-sources'>;
