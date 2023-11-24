/**
 * This file defines *all* steps of the slicing process and the data they require.
 *
 * Note, that the order of elements here also describes the *desired* order of their desired execution for readability.
 * However, it is the {@link SteppingSlicer} which controls the order of execution and the steps required to achieve a given result.
 *
 * If you add a new step, you have to (at least) update the {@link SteppingSlicer} as well as the corresponding type predicate {@link SteppingSlicerInput}.
 * Furthermore, if your step is the new *last* step, please update {@link LAST_STEP}.
 *
 * Please note that the combination of `satisfies` and `as` seems to be required.
 * With `satisfies` we make sure that the respective element has all the keys it requires, and the `as` force the type to be exactly the given one
 *
 * @module
 */

import {
	normalize,
	retrieveXmlFromRCode
} from '../../r-bridge'
import { produceDataFlowGraph } from '../../dataflow'
import { reconstructToCode, staticSlicing } from '../../slicing'
import { internalPrinter, StepOutputFormat } from '../print/print'
import {
	normalizedAstToJson,
	normalizedAstToQuads,
	printNormalizedAstToMermaid,
	printNormalizedAstToMermaidUrl
} from '../print/normalize-printer'
import {
	dataflowGraphToJson,
	dataflowGraphToMermaid,
	dataflowGraphToMermaidUrl,
	dataflowGraphToQuads
} from '../print/dataflow-printer'
import { parseToQuads } from '../print/parse-printer'
import { IStep, StepHasToBeExecuted } from './step'
import { PARSE_WITH_R_SHELL_STEP } from './all/00-parse'
import { NORMALIZE } from './all/10-normalize'
import { LEGACY_STATIC_DATAFLOW } from './all/20-dataflow'
import { STATIC_SLICE } from './all/static-slicing/30-slice'
import { NAIVE_RECONSTRUCT } from './all/static-slicing/40-reconstruct'


export const STEPS_PER_FILE = {
	'parse':     PARSE_WITH_R_SHELL_STEP,
	'normalize': NORMALIZE,
	'dataflow':  LEGACY_STATIC_DATAFLOW
} as const

export const STEPS_PER_SLICE = {
	'slice':       STATIC_SLICE,
	'reconstruct': NAIVE_RECONSTRUCT
} as const

export const STEPS = { ...STEPS_PER_FILE, ...STEPS_PER_SLICE } as const
export const LAST_PER_FILE_STEP = 'dataflow' as const
export const LAST_STEP = 'reconstruct' as const

export type StepName = keyof typeof STEPS
export type Step<Name extends StepName> = typeof STEPS[Name]
export type StepProcessor<Name extends StepName> = Step<Name>['processor']
export type StepResult<Name extends StepName> = Awaited<ReturnType<StepProcessor<Name>>>

export function executeSingleSubStep<Name extends StepName, Processor extends StepProcessor<Name>>(subStep: Name, ...input: Parameters<Processor>): ReturnType<Processor> {
	// @ts-expect-error - this is safe, as we know that the function arguments are correct by 'satisfies', this saves an explicit cast with 'as'
	return STEPS[subStep].processor(...input as unknown as never[]) as ReturnType<Processor>
}
