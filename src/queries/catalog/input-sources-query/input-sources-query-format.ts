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
import { criteriaQueryCompleter, sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import { executeInputSourcesQuery } from './input-sources-query-executor';
import { SourceLocation } from '../../../util/range';
import { Q } from '../../../search/flowr-search-builder';
import { LintingResultCertainty } from '../../../linter/linter-format';
import { Record } from '../../../util/record';
import { ReadFunctions } from '../dependencies-query/function-info/read-functions';
import { LinkedInputEntryPoints, LinkedInputObjects, NarrowingFunctions } from './input-source-functions';
import { CallProp, InputProps } from '../../../dataflow/environments/built-in-props';
import { builtInsWith, builtInsWithout } from '../../../dataflow/environments/query-fn-props';

export type InputSourcesQueryConfig = InputClassifierConfig;
/**
 * Calculates provenance for all inputs and their transformations
 * based on the `provenance` of a given function.
 */
export interface InputSourcesQuery extends BaseQueryFormat {
	readonly type:      'input-sources';
	/**
	 * One or more slicing criteria to analyze; each is resolved independently and keyed by its
	 * criterion string in the result map.  Supplying an array allows batching multiple lookups
	 * into a single round-trip.
	 * {@link SlicingCriterion.fromId}
	 */
	readonly criterion: SlicingCriterion | readonly SlicingCriterion[],
	readonly config?:   InputSourcesQueryConfig
}

/**
 * Which functions belong to which input type is stated with the functions themselves, in the
 * {@link DefaultBuiltinConfig|built-in configuration}: a function that states its props and carries none of the
 * {@link InputProps} derives its result from its arguments, the others bring in data of their own.
 * Add a function there (or override its props with your own built-in definitions) and it shows up here.
 */
export const DefaultInputClassifierConfig: InputClassifierConfig = {
	[InputTraceType.Pure]: builtInsWithout(InputProps),
	[InputType.File]:      [...ReadFunctions.map(readFunction => readFunction.name), ...builtInsWith(CallProp.File)],
	[InputType.TempFile]:  builtInsWith(CallProp.TempFile),
	[InputType.Network]:   Q.fromQuery({ type: 'linter', rules: ['network-functions'] }, LintingResultCertainty.Certain),
	[InputType.Random]:    Q.fromQuery({ type: 'linter', rules: ['seeded-randomness'] }),
	[InputType.System]:    builtInsWith(CallProp.Process),
	[InputType.Ffi]:       builtInsWith(CallProp.Ffi),
	[InputType.Lang]:      builtInsWith(CallProp.Lang),
	[InputType.Options]:   builtInsWith(CallProp.Ambient),
	[InputType.User]:      builtInsWith(CallProp.User),
	linkedObjects:         LinkedInputObjects,
	linkedEntryPoints:     LinkedInputEntryPoints,
	narrowing:             NarrowingFunctions
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
	title:           'Input Sources Query',
	executor:        executeInputSourcesQuery,
	asciiSummarizer: async(formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'input-sources'>['input-sources'];
		result.push(`Query: ${bold('input-sources', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		const nast = (await analyzer.normalize()).idMap;
		for(const [key, sources] of Object.entries(out.results)) {
			result.push(`   ╰ Input Sources for ${key}`);
			for(const { id, trace, types, name, value, declaredAt } of sources) {
				const kNode = nast.get(id);
				const kLoc = kNode ? SourceLocation.format(SourceLocation.fromNode(kNode)) : 'unknown location';
				const nameStr  = name  !== undefined ? `, name: ${name}` : '';
				const valueStr = value !== undefined ? `, value: ${JSON.stringify(value)}` : '';
				const declStr  = declaredAt ? `, declared at: ${declaredAt.map(d => {
					const dNode = nast.get(d);
					return dNode ? SourceLocation.format(SourceLocation.fromNode(dNode)) : String(d);
				}).join(', ')}` : '';
				result.push(
					`           ╰ ${kLoc} (id: ${id}), type: ${JSON.stringify(types)}, trace: ${trace}${nameStr}${valueStr}${declStr}`
				);
			}
		}
		return true;
	},
	fromLine:  inputSourcesQueryLineParser,
	completer: criteriaQueryCompleter,
	syntax:    '@input-sources (<criterion>) <code | file://path>',
	schema:    Joi.object({
		type:      Joi.string().valid('input-sources').required().description('The type of the query.'),
		criterion: Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())).required().description('The slicing criterion or array of criteria to use.'),
		config:    Joi.object({
			[InputTraceType.Pure]: Joi.array().items(Joi.string()).optional().description('Deterministic/pure functions: functions that preserve constantness of their inputs (e.g., arithmetic, parse).'),
			[InputType.File]:      Joi.array().items(Joi.string()).optional().description('Functions that read from the filesystem and produce data (e.g., read.csv, readRDS).'),
			[InputType.TempFile]:  Joi.array().items(Joi.string()).optional().description('Functions that produce temporary file paths (sub-type of File; e.g., tempfile, tempdir).'),
			[InputType.Network]:   Joi.array().items(Joi.string()).optional().description('Functions that fetch data from the network (e.g., download.file, url connections).'),
			[InputType.Random]:    Joi.array().items(Joi.string()).optional().description('Functions that produce randomness (e.g., runif, rnorm).'),
			[InputType.System]:    Joi.array().items(Joi.string()).optional().description('Functions that execute system commands (e.g., system, system2, shell, pipe).'),
			[InputType.Ffi]:       Joi.array().items(Joi.string()).optional().description('Functions that call native code via the R FFI (.C, .Call, .Fortran, .External, dyn.load).'),
			[InputType.Lang]:      Joi.array().items(Joi.string()).optional().description('Functions that produce language objects (e.g., substitute, quote, bquote, expression).'),
			[InputType.Options]:   Joi.array().items(Joi.string()).optional().description('Functions that access or set global options (e.g., options, getOption).'),
			[InputType.User]:      Joi.array().items(Joi.string()).optional().description('Functions that read interactive user input (e.g., file.choose, readline, menu, askYesNo).'),
			linkedObjects:         Joi.array().items(Joi.object({
				name:       Joi.string().required().description('Name of the object, e.g. input.'),
				type:       Joi.string().valid(...Record.values<string>(InputType)).required().description('How reads of the object (or of its fields) are classified.'),
				withParams: Joi.array().items(Joi.string()).optional().description('Only link the object if the function binding it declares all of these parameters as well.')
			})).optional().description('Objects a framework provides without a definition in the code, e.g. shiny\'s input.'),
			linkedEntryPoints: Joi.array().items(Joi.object({
				call:    Joi.string().required().description('The call taking the function, e.g. shiny::shinyApp.'),
				argName: Joi.string().required().description('Name of the argument holding the function.'),
				argIdx:  Joi.number().required().description('Index of that argument when it is passed positionally.'),
				params:  Joi.array().items(Joi.string().allow(null)).required().description('Which linkedObject the framework binds to each parameter, by position.')
			})).optional().description('Calls that hand a function to a framework, which binds its objects to the parameters by position.')
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
