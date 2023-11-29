import { internalPrinter, StepOutputFormat } from '../../../print/print'
import { IPipelineStep, PipelineStepStage } from '../../step'
import { SlicingCriteria, staticSlicing } from '../../../../slicing'
import { DeepReadonly } from 'ts-essentials'
import { NormalizeRequiredInput } from '../core/10-normalize'
import { DataflowInformation } from '../../../../dataflow/internal/info'
import { NormalizedAst } from '../../../../r-bridge'

export interface SliceRequiredInput extends NormalizeRequiredInput {
	/** The slicing criterion is only of interest if you actually want to slice the R code */
	readonly criterion: SlicingCriteria,
	/** How many re-visits of the same node are ok? TODO: use default? */
	readonly threshold?: number
}

export const STATIC_SLICE = {
	name:        'slice',
	description: 'Calculate the actual static slice from the dataflow graph and the given slicing criteria',
	processor:   (results: { dataflow?: DataflowInformation, normalize?: NormalizedAst }, input: Partial<SliceRequiredInput>) =>
		staticSlicing((results.dataflow as DataflowInformation).graph, results.normalize as NormalizedAst, input.criterion as SlicingCriteria, input.threshold),
	executed: PipelineStepStage.OncePerRequest,
	printer:  {
		[StepOutputFormat.Internal]: internalPrinter
	},
	dependencies:  [ 'dataflow' ],
	requiredInput: undefined as unknown as SliceRequiredInput
} as const satisfies DeepReadonly<IPipelineStep<'slice', (results: { dataflow?: DataflowInformation, normalize?: NormalizedAst }, input: Partial<SliceRequiredInput>) => ReturnType<typeof staticSlicing>>>
