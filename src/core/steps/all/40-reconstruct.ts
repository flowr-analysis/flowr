import { internalPrinter, StepOutputFormat } from '../../print/print'
import { IStep } from '../step'
import { reconstructToCode } from '../../../slicing'

export const NAIVE_RECONSTRUCT = {
	name:        'reconstruct',
	description: 'Reconstruct R code from the static slice',
	processor:   reconstructToCode,
	required:    'once-per-slice',
	printer:     {
		[StepOutputFormat.Internal]: internalPrinter
	},
	dependencies: [ 'slice' ]
} satisfies IStep<typeof reconstructToCode>
