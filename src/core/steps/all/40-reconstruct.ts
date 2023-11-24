import { internalPrinter, StepOutputFormat } from '../../print/print'
import { IStep } from '../step'
import { AutoSelectPredicate, reconstructToCode } from '../../../slicing'
import { DeepReadonly } from 'ts-essentials'

export const NAIVE_RECONSTRUCT = {
	name:        'reconstruct',
	description: 'Reconstruct R code from the static slice',
	processor:   reconstructToCode,
	required:    'once-per-slice',
	printer:     {
		[StepOutputFormat.Internal]: internalPrinter
	},
	dependencies:  [ 'slice' ],
	requiredInput: {
		/** If you want to auto-select something in the reconstruction add it here, otherwise, it will use the default defined alongside {@link reconstructToCode}*/
		autoSelectIf: undefined as unknown as AutoSelectPredicate
	}
} as const satisfies DeepReadonly<IStep<'reconstruct', typeof reconstructToCode>>
