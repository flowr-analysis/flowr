import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { PipelineOutput } from '../../../core/steps/pipeline/pipeline';
import type {
	DEFAULT_DATAFLOW_PIPELINE, DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE,
	DEFAULT_SLICING_PIPELINE
} from '../../../core/steps/pipeline/default-pipelines';
import type { SlicingCriteria } from '../../../slicing/criterion/parse';

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
