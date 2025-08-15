import { internalPrinter, StepOutputFormat } from '../../../print/print';
import type { IPipelineStep } from '../../pipeline-step';
import { PipelineStepStage } from '../../pipeline-step';
import type { DeepReadonly } from 'ts-essentials';
import type { DataflowInformation } from '../../../../dataflow/info';
import type { SlicingCriteria } from '../../../../slicing/criterion/parse';
import type { NormalizedAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrConfigOptions } from '../../../../config';
import { staticSlice } from '../../../../slicing/static/static-slicer';

export interface SliceRequiredInput {
	/** The slicing criterion is only of interest if you actually want to slice the R code */
	readonly criterion:  SlicingCriteria,
	/** How many re-visits of the same node are ok? */
	readonly threshold?: number
	/** The direction to slice in. Defaults to backward slicing if unset. */
	readonly direction?: SliceDirection
}

export enum SliceDirection {
	Backward = 'backward',
	Forward = 'forward'
}

function processor(results: { dataflow?: DataflowInformation, normalize?: NormalizedAst }, input: Partial<SliceRequiredInput>, _config: FlowrConfigOptions) {
	const direction = input.direction ?? SliceDirection.Backward;
	return staticSlice((results.dataflow as DataflowInformation).graph, results.normalize as NormalizedAst, input.criterion as SlicingCriteria, direction, input.threshold);
}

export const STATIC_SLICE = {
	name:              'slice',
	humanReadableName: 'static slice',
	description:       'Calculate the actual static slice from the dataflow graph and the given slicing criteria',
	processor,
	executed:          PipelineStepStage.OncePerRequest,
	printer:           {
		[StepOutputFormat.Internal]: internalPrinter
	},
	dependencies:  [ 'dataflow' ],
	requiredInput: undefined as unknown as SliceRequiredInput
} as const satisfies DeepReadonly<IPipelineStep<'slice', typeof processor>>;
