import { internalPrinter, StepOutputFormat } from '../../../print/print'
import { IPipelineStep, PipelineStepStage } from '../../step'
import { autoSelectLibrary, AutoSelectPredicate, reconstructToCode, SliceResult } from '../../../../slicing'
import { DeepReadonly } from 'ts-essentials'
import { NormalizedAst } from '../../../../r-bridge'
import { SliceRequiredInput } from './30-slice'

export interface ReconstructRequiredInput extends SliceRequiredInput {
	autoSelectIf?: AutoSelectPredicate
}

export const NAIVE_RECONSTRUCT = {
	name:        'reconstruct',
	description: 'Reconstruct R code from the static slice',
	processor:   (results: { normalize?: NormalizedAst, slice?: SliceResult }, input: Partial<ReconstructRequiredInput>) => reconstructToCode(results.normalize as NormalizedAst, (results.slice as SliceResult).result, input.autoSelectIf),
	executed:    PipelineStepStage.OncePerRequest,
	printer:     {
		[StepOutputFormat.Internal]: internalPrinter
	},
	dependencies:  [ 'slice' ],
	requiredInput: undefined as unknown as ReconstructRequiredInput
} as const satisfies DeepReadonly<IPipelineStep<'reconstruct', (results: { normalize?: NormalizedAst, slice?: SliceResult }, input: Partial<ReconstructRequiredInput>) => ReturnType<typeof reconstructToCode>>>
