import { internalPrinter, StepOutputFormat } from '../../print/print'
import { IStep } from '../step'
import { staticSlicing } from '../../../slicing'
import { DeepReadonly } from 'ts-essentials'

export const STATIC_SLICE = {
	name:        'slice',
	description: 'Calculate the actual static slice from the dataflow graph and the given slicing criteria',
	processor:   staticSlicing,
	required:    'once-per-slice',
	printer:     {
		[StepOutputFormat.Internal]: internalPrinter
	},
	dependencies: [ 'dataflow' ]
} as const satisfies DeepReadonly<IStep<typeof staticSlicing>>
