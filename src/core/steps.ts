/**
 * This file defines *all* steps of the slicing process and the data they require.
 *
 * Note, that the order of elements here also describes the *desired* order of their desired execution for readability.
 * However, it is the {@link SteppingSlicer} which controls the order of execution and the steps required to achieve a given result.
 *
 * If you add a new step, you have to (at least) update the {@link SteppingSlicer} as well as the corresponding type predicate {@link SteppingSlicerInput}.
 * Furthermore, if your step is the new *last* step, please update {@link LAST_STEP}.
 *
 * TODO: add a visualizer for each step for the given format
 * TODO: add a differ for each step?
 *
 * @module
 */

import { MergeableRecord } from '../util/objects'
import {
	decorateAst, NoInfo,
	normalize,
	retrieveXmlFromRCode
} from '../r-bridge'
import { produceDataFlowGraph } from '../dataflow'
import { convertAllSlicingCriteriaToIds, reconstructToCode, staticSlicing } from '../slicing'

/**
 * The names of all main steps of the slicing process.
 */
export const STEP_NAMES = ['parse', 'normalize', 'decorate', 'dataflow', 'slice', 'reconstruct'] as const

type StepFunction = (...args: never[]) => unknown

export type StepRequired = 'once-per-file' | 'once-per-slice'

/**
 * Defines what is to be known of a single step in the slicing process.
 * These steps may be more fine-grained than the overall steps defined of flowR. These are linked within `step`
 */
interface ISubStep<Fn extends StepFunction> extends MergeableRecord {
	/** The step that this (sub-)step depends on */
	step:        typeof STEP_NAMES[number],
	/** Human-readable description of this (sub-)step */
	description: string
	/** The main processor that essentially performs the logic of this step */
	processor:   (...input: Parameters<Fn>) => ReturnType<Fn>
	/* does this step has to be repeated for each new slice or can it be performed only once in the initialization */
	required:    StepRequired
}

export const STEPS_PER_FILE = {
	'parse': {
		step:        'parse',
		description: 'Parse the given R code into an AST',
		processor:   retrieveXmlFromRCode,
		required:    'once-per-file'
	} as ISubStep<typeof retrieveXmlFromRCode>,
	'normalize ast': {
		step:        'normalize',
		description: 'Normalize the AST to flowR\'s AST (first step of the normalization)',
		processor:   normalize,
		required:    'once-per-file'
	} as ISubStep<typeof normalize>,
	'decorate': {
		step:        'normalize',
		description: 'Transform flowR\'s AST into a doubly linked tree with parent references (second step of the normalization)',
		processor:   decorateAst<NoInfo>,
		required:    'once-per-file'
	} as ISubStep<typeof decorateAst<NoInfo>>,
	'dataflow': {
		description: 'Construct the dataflow graph',
		processor:   produceDataFlowGraph,
		required:    'once-per-file',
	} as ISubStep<typeof produceDataFlowGraph>
} as const


export const STEPS_PER_SLICE = {
	'decode criteria': {
		step:        'slice',
		description: 'Decode the slicing criteria into a collection of node ids',
		processor:   convertAllSlicingCriteriaToIds,
		required:    'once-per-slice',
	} as ISubStep<typeof convertAllSlicingCriteriaToIds>,
	'slice': {
		step:        'slice',
		description: 'Calculate the actual static slice from the dataflow graph and the given slicing criteria',
		processor:   staticSlicing,
		required:    'once-per-slice',
	} as ISubStep<typeof staticSlicing>,
	'reconstruct': {
		step:        'reconstruct',
		description: 'Reconstruct R code from the static slice',
		processor:   reconstructToCode,
		required:    'once-per-slice',
	} as ISubStep<typeof reconstructToCode>
} as const

export const STEPS = { ...STEPS_PER_FILE, ...STEPS_PER_SLICE } as const
export const LAST_STEP: keyof typeof STEPS = 'reconstruct' as const

export type SubStepName = keyof typeof STEPS
export type SubStep<name extends SubStepName> = typeof STEPS[name]
export type SubStepProcessor<name extends SubStepName> = SubStep<name>['processor']

export function executeSingleSubStep<Name extends SubStepName, Processor extends SubStepProcessor<Name>>(subStep: Name, ...input: Parameters<Processor>): ReturnType<Processor> {
	return STEPS[subStep].processor(...input as unknown as never[]) as ReturnType<Processor>
}

