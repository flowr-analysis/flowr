import { internalPrinter, StepOutputFormat } from '../../print/print'
import { IStep } from '../step'
import { reconstructToCode } from '../../../slicing'
import { DeepReadonly } from 'ts-essentials'

export const NAIVE_RECONSTRUCT = {
	name:        'reconstruct',
	description: 'Reconstruct R code from the static slice',
	processor:   reconstructToCode,
	required:    'once-per-slice',
	printer:     {
		[StepOutputFormat.Internal]: internalPrinter
	},
	dependencies: [ 'slice' ]
} as const satisfies DeepReadonly<IStep<'reconstruct', typeof reconstructToCode>>
