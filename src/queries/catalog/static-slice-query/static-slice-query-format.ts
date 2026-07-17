import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { PipelineOutput } from '../../../core/steps/pipeline/pipeline';
import type {
	DEFAULT_DATAFLOW_PIPELINE,
	DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE,
	DEFAULT_SLICING_PIPELINE
} from '../../../core/steps/pipeline/default-pipelines';
import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold, ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { executeStaticSliceQuery } from './static-slice-query-executor';
import { summarizeIdsIfTooLong } from '../../query-print';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { StaticSliceFlags, criteriaQueryCompleter, describeSliceFlags, queryLineCode, sliceCriteriaParser, sliceDirectionParser, sliceQueryOptionsParser, warnAboutSliceFlags } from '../../../cli/repl/parser/slice-query-parser';
import { type SliceQueryOptions, SliceQueryOptionsSchema } from '../slice-query-options';
import { SliceDirection } from '../../../util/slice-direction';

/** Calculates and returns the static backward or forward slice from the given criteria */
export interface StaticSliceQuery extends BaseQueryFormat, SliceQueryOptions {
	readonly type:       'static-slice';
	/** The slicing criteria to use */
	readonly criteria:   SlicingCriteria,
	/** The direction to slice in. Defaults to backward slicing if unset. */
	readonly direction?: SliceDirection
}

export interface StaticSliceQueryResult extends BaseQueryResult {
	/**
	 * only contains the results of the slice steps to not repeat ourselves, this does not contain the reconstruction
	 * if you set the {@link SliceQuery#noReconstruction|noReconstruction} flag.
	 *
	 * The keys are serialized versions of the used queries (i.e., the result of `JSON.stringify`).
	 * This implies that multiple slice queries with the same query configuration will _not_ be re-executed.
	 */
	results: Record<string,
		Omit<PipelineOutput<typeof DEFAULT_SLICING_PIPELINE>, keyof PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>> |
		Omit<PipelineOutput<typeof DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE>, keyof PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>>
	>
}

const SliceCriterionHelp = [
	'Each criterion picks one element of the program, separate multiple ones with ";":',
	'  <line>@<name>       <name> in line <line>, preferring a call over the symbol (e.g. 2@x)',
	'  <line>@[<n>]<name>  the n-th occurrence of <name> in line <line> (e.g. 2@[2]x, 2@[-1]x)',
	'  <line>:<col>        the element starting at line <line>, column <col> (e.g. 2:5)',
	'  <line>~<col>        the innermost element containing line <line>, column <col> (e.g. 2~5)',
	'  $<id>               the normalized node with the id <id> (e.g. $42)',
	'A negative <line> counts from the end; a trailing (file-regex) restricts to a file (e.g. 2@x(tmp/.*)).',
	`Append flags after the ")": ${describeSliceFlags(StaticSliceFlags)}.`,
	'Example: :query @static-slice (2@x;3:1)fc'
].join('\n');

function sliceQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'static-slice'> {
	const criteria = sliceCriteriaParser(line[0]);
	const direction = sliceDirectionParser(line[0]);
	const options = sliceQueryOptionsParser(line[0]);
	if(!criteria || criteria.length === 0) {
		output.stderr(output.formatter.format('Invalid static-slice query format, slicing criteria must be given in the form "(criterion1;criterion2;...)"',
			{ color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		output.stderr(SliceCriterionHelp);
		return { query: [] };
	}
	warnAboutSliceFlags(output, line[0], StaticSliceFlags);

	return { query: [
		{
			type:      'static-slice',
			criteria:  criteria,
			direction: direction,
			...options
		}], rCode: queryLineCode(line) } ;
}

export const StaticSliceQueryDefinition = {
	executor:        executeStaticSliceQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'static-slice'>['static-slice'];
		if(Object.keys(out.results).length === 1) {
			// just print the single result without fingerprint
			const [, obj] = Object.entries(out.results)[0];
			if('reconstruct' in obj) {
				const code = Array.isArray(obj.reconstruct.code) ? obj.reconstruct.code : [obj.reconstruct.code];
				if(code.length === 1) {
					result.push(
						code[0]
					);
					return true;
				}
			}
		}
		result.push(`Query: ${bold('static-slice', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [fingerprint, obj] of Object.entries(out.results)) {
			const { criteria, noMagicComments, noReconstruction } = JSON.parse(fingerprint) as StaticSliceQuery;
			const addons = [];
			if(noReconstruction) {
				addons.push('no reconstruction');
			}
			if(noMagicComments) {
				addons.push('no magic comments');
			}
			result.push(`   ╰ Slice for {${criteria.join(', ')}} ${addons.join(', ')}`);
			if('reconstruct' in obj) {
				const code = Array.isArray(obj.reconstruct.code) ? obj.reconstruct.code : [obj.reconstruct.code];
				result.push('     ╰ Code (newline as <code>&#92;n</code>): <code>' + code.flatMap(c => c.split('\n')).join('\\n') + '</code>');
			} else {
				result.push(`     ╰ Id List: {${summarizeIdsIfTooLong(formatter, [...obj.slice.result])}}`);
			}
		}
		return true;
	},
	fromLine:  sliceQueryLineParser,
	completer: criteriaQueryCompleter,
	schema:    Joi.object({
		type:      Joi.string().valid('static-slice').required().description('The type of the query.'),
		criteria:  Joi.array().items(Joi.string()).min(0).required().description('The slicing criteria to use.'),
		direction: Joi.string().valid(...Object.values(SliceDirection)).optional().description('The direction to slice in. Defaults to backward slicing if unset.'),
		...SliceQueryOptionsSchema
	}).description('Slice query used to slice the dataflow graph'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult) => {
		const flattened: NodeId[] = [];
		const out = queryResults as QueryResults<'static-slice'>['static-slice'];
		for(const [_, obj] of Object.entries(out.results)) {
			flattened.push(...obj.slice.result);
		}
		return flattened;
	}
} as const satisfies SupportedQuery<'static-slice'>;
