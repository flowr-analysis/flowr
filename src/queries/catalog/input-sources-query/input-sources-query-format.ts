import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold, ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { InputTraceType, InputType, type InputClassifierConfig, type InputSources } from './simple-input-classifier';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import { executeInputSourcesQuery } from './input-sources-query-executor';
import { SourceLocation } from '../../../util/range';
import { Q } from '../../../search/flowr-search-builder';
import { ReadFunctions } from '../dependencies-query/function-info/read-functions';
import { FfiFunctions, LangFunctions, OptionsFunctions, PureFunctions, SystemFunctions } from './input-source-functions';

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

export const DefaultInputClassifierConfig: InputClassifierConfig = {
	[InputTraceType.Pure]: PureFunctions,
	[InputType.File]:      ReadFunctions.map(readFunction => readFunction.name),
	[InputType.Network]:   Q.fromQuery({ type: 'linter', rules: ['network-functions'] }),
	[InputType.Random]:    Q.fromQuery({ type: 'linter', rules: ['seeded-randomness'] }),
	[InputType.System]:    SystemFunctions,
	[InputType.Ffi]:       FfiFunctions,
	[InputType.Lang]:      LangFunctions,
	[InputType.Options]:   OptionsFunctions
};

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
			for(const { id, trace, types } of sources) {
				const kNode = nast.get(id);
				const kLoc = kNode ? SourceLocation.format(SourceLocation.fromNode(kNode)) : 'unknown location';
				result.push(
					`           ╰ ${kLoc} (id: ${id}), type: ${JSON.stringify(types)}, trace: ${trace}`
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
			pureFns:     Joi.array().items(Joi.string()).optional().description('Deterministic/pure functions: functions that preserve constantness of their inputs (e.g., arithmetic, parse).'),
			networkFns:  Joi.array().items(Joi.string()).optional().description('Functions that fetch data from the network (e.g., download.file, url connections).'),
			randomFns:   Joi.array().items(Joi.string()).optional().description('Functions that produce randomness (e.g., runif, rnorm).'),
			readFileFns: Joi.array().items(Joi.string()).optional().description('Functions that read from the filesystem and produce data (e.g., read.csv, readRDS).'),
			systemFns:   Joi.array().items(Joi.string()).optional().description('Functions that execute system commands (e.g., system, system2, shell, pipe).'),
			ffiFns:      Joi.array().items(Joi.string()).optional().description('Functions that call native code via the R FFI (.C, .Call, .Fortran, .External, dyn.load).'),
			langFns:     Joi.array().items(Joi.string()).optional().description('Functions that produce language objects (e.g., substitute, quote, bquote, expression).'),
			optionsFns:  Joi.array().items(Joi.string()).optional().description('Functions that access or set global options (e.g., options, getOption).'),
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
