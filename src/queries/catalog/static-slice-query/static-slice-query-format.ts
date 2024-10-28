import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { PipelineOutput } from '../../../core/steps/pipeline/pipeline';
import type {
	DEFAULT_DATAFLOW_PIPELINE, DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE,
	DEFAULT_SLICING_PIPELINE
} from '../../../core/steps/pipeline/default-pipelines';
import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';
import { executeStaticSliceClusterQuery } from './static-slice-query-executor';

import { summarizeIdsIfTooLong } from '../../query-print';

/** Calculates and returns all clusters encountered in the dataflow graph. */
export interface StaticSliceQuery extends BaseQueryFormat {
	readonly type:              'static-slice';
	/** The slicing criteria to use */
	readonly criteria:          SlicingCriteria,
	/** do not reconstruct the slice into readable code */
	readonly noReconstruction?: boolean;
	/** Should the magic comments (force-including lines within the slice) be ignored? */
	readonly noMagicComments?:  boolean
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

export const StaticSliceQueryDefinition = {
	executor:        executeStaticSliceClusterQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
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
	schema: Joi.object({
		type:             Joi.string().valid('static-slice').required().description('The type of the query.'),
		criteria:         Joi.array().items(Joi.string()).min(0).required().description('The slicing criteria to use.'),
		noReconstruction: Joi.boolean().optional().description('Do not reconstruct the slice into readable code.'),
		noMagicComments:  Joi.boolean().optional().description('Should the magic comments (force-including lines within the slice) be ignored?')
	}).description('Slice query used to slice the dataflow graph')
} as const satisfies SupportedQuery<'static-slice'>;
