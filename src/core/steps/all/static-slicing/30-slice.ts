import { internalPrinter, StepOutputFormat } from '../../../print/print'
import { IStep, StepHasToBeExecuted } from '../../step'
import { SlicingCriteria, staticSlicing } from '../../../../slicing'
import { DeepReadonly } from 'ts-essentials'
import { NormalizeRequiredInput } from '../core/10-normalize'
import { DataflowInformation } from '../../../../dataflow/internal/info'
import { NormalizedAst } from '../../../../r-bridge'

export const SliceRequiredInput = {
	...NormalizeRequiredInput,
	/** The slicing criterion is only of interest if you actually want to slice the R code */
	criterion: undefined as unknown as SlicingCriteria,
	/** How many re-visits of the same node are ok? TODO: use default? */
	threshold: 75
} as const


export const STATIC_SLICE = {
	name:        'slice',
	description: 'Calculate the actual static slice from the dataflow graph and the given slicing criteria',
	processor:   (results: { dataflow?: DataflowInformation, normalize?: NormalizedAst }, input: Partial<typeof SliceRequiredInput>) =>
		staticSlicing((results.dataflow as DataflowInformation).graph, results.normalize as NormalizedAst, input.criterion as SlicingCriteria, input.threshold),
	executed: StepHasToBeExecuted.OncePerRequest,
	printer:  {
		[StepOutputFormat.Internal]: internalPrinter
	},
	dependencies:  [ 'dataflow' ],
	requiredInput: SliceRequiredInput
} as const satisfies DeepReadonly<IStep<'slice', (results: { dataflow?: DataflowInformation, normalize?: NormalizedAst }, input: Partial<typeof SliceRequiredInput>) => ReturnType<typeof staticSlicing>>>
