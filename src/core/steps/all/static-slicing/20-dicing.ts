import type { DeepReadonly } from 'ts-essentials'
import type { DataflowInformation } from '../../../../dataflow/info'
import type { NormalizedAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { SlicingCriteria } from '../../../../slicing/criterion/parse'
import { PipelineStepStage } from '../../pipeline-step'
import type { IPipelineStep } from '../../pipeline-step'
import { internalPrinter, StepOutputFormat } from '../../../print/print'
import { staticDicing } from '../../../../slicing/static/dicer'

export interface DiceRequiredInput {
	/** The slicing criterion is only of interest if you actually want to Dice the R code */
	readonly startingCriterion: SlicingCriteria,
    
    readonly endCriterion: SlicingCriteria,
	
    /** How many re-visits of the same node are ok? */
	readonly threshold?: number
}

function processor(results: { dataflow?: DataflowInformation, normalize?: NormalizedAst }, input: Partial<DiceRequiredInput>) {
	return staticDicing((results.dataflow as DataflowInformation).graph, results.normalize as NormalizedAst, input.endCriterion as SlicingCriteria, input.startingCriterion as SlicingCriteria, input.threshold)
}

export const STATIC_DICE = {
	name:              'dice',
	humanReadableName: 'static dice',
	description:       'Calculate the actual static dice from the dataflow graph and the given slicing criteria',
	processor,
	executed:          PipelineStepStage.OncePerRequest,
	printer:           {
		[StepOutputFormat.Internal]: internalPrinter
	},
	dependencies:  [ 'dataflow' ],
	requiredInput: undefined as unknown as DiceRequiredInput
} as const satisfies DeepReadonly<IPipelineStep<'dice', typeof processor>>