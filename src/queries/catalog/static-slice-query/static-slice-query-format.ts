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
import { SliceDirection } from '../../../core/steps/all/static-slicing/00-slice';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfigOptions } from '../../../config';
import { sliceCriteriaParser, sliceDirectionParser } from '../../../cli/repl/parser/slice-query-parser';

/** Calculates and returns all clusters encountered in the dataflow graph. */
export interface StaticSliceQuery extends BaseQueryFormat {
	readonly type:              'static-slice';
	/** The slicing criteria to use */
	readonly criteria:          SlicingCriteria,
	/** do not reconstruct the slice into readable code */
	readonly noReconstruction?: boolean;
	/** Should the magic comments (force-including lines within the slice) be ignored? */
	readonly noMagicComments?:  boolean
	/** The direction to slice in. Defaults to backward slicing if unset. */
	readonly direction?:        SliceDirection
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

function sliceQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'static-slice'> {
	const criteria = sliceCriteriaParser(line[0]);
	const direction = sliceDirectionParser(line[0]);
	const input = line[1];

	if(!criteria || criteria.length == 0) {
		output.stderr(output.formatter.format('Invalid static-slice query format, slicing criteria must be given in the form "(criterion1,criterion2,...)"',
			{ color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}

	return { query: [
		{
			type:      'static-slice',
			criteria:  criteria,
			direction: direction,
		}], rCode: input } ;
}

export const StaticSliceQueryDefinition = {
	executor:        executeStaticSliceQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'static-slice'>['static-slice'];
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
				result.push('     ╰ Code (newline as <code>&#92;n</code>): <code>' + obj.reconstruct.code.split('\n').join('\\n') + '</code>');
			} else {
				result.push(`     ╰ Id List: {${summarizeIdsIfTooLong(formatter, [...obj.slice.result])}}`);
			}
		}
		return true;
	},
	fromLine: sliceQueryLineParser,
	schema:   Joi.object({
		type:             Joi.string().valid('static-slice').required().description('The type of the query.'),
		criteria:         Joi.array().items(Joi.string()).min(0).required().description('The slicing criteria to use.'),
		noReconstruction: Joi.boolean().optional().description('Do not reconstruct the slice into readable code.'),
		noMagicComments:  Joi.boolean().optional().description('Should the magic comments (force-including lines within the slice) be ignored?'),
		direction:        Joi.string().valid(...Object.values(SliceDirection)).optional().description('The direction to slice in. Defaults to backward slicing if unset.')
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
