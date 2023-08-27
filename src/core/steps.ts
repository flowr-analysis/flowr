/**
 * This file defines *all* steps of the slicing process and the data they require.
 */
import { MergeableRecord } from '../util/objects'
import {
	decorateAst,
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
	processor:   (input: Parameters<Fn>) => ReturnType<Fn>
	/* does this step has to be repeated for each new slice or can it be performed only once in the initialization */
	required:    StepRequired
}

// TODO: update the benchmark slicer accordingly
// TODO: allow to append a *formatter* that can produce text/mermaid etc. output from the result for each step
/**
 * Note, that the order of elements here also describes the *desired* order of their desired execution for readability.
 * However, it is the {@link SteppingSlicer} which controls the order of execution and the steps required to achieve a given result.
 */
export const STEPS_PER_FILE = {
	'parse': {
		step:        'parse',
		description: 'Parse the given R code into an AST',
		processor:   input => retrieveXmlFromRCode(...input),
		required:    'once-per-file'
	} as ISubStep<typeof retrieveXmlFromRCode>,
	'normalize ast': {
		step:        'normalize',
		description: 'Normalize the AST to flowR\'s AST (first step of the normalization)',
		processor:   input => normalize(...input),
		required:    'once-per-file'
	} as ISubStep<typeof normalize>,
	'decorate': {
		step:        'normalize',
		description: 'Transform flowR\'s AST into a doubly linked tree with parent references (second step of the normalization)',
		processor:   input => decorateAst(...input),
		required:    'once-per-file'
	} as ISubStep<typeof decorateAst>,
	'dataflow': {
		description: 'Construct the dataflow graph',
		processor:   input => produceDataFlowGraph(...input),
		required:    'once-per-file',
	} as ISubStep<typeof produceDataFlowGraph>
} as const


export const STEPS_PER_SLICE = {
	'decode criteria': {
		step:        'slice',
		description: 'Decode the slicing criteria into a collection of node ids',
		processor:   input => convertAllSlicingCriteriaToIds(...input),
		required:    'once-per-slice',
	} as ISubStep<typeof convertAllSlicingCriteriaToIds>,
	'slice': {
		step:        'slice',
		description: 'Calculate the actual static slice from the dataflow graph and the given slicing criteria',
		processor:   input => staticSlicing(...input),
		required:    'once-per-slice',
	} as ISubStep<typeof staticSlicing>,
	'reconstruct': {
		step:        'reconstruct',
		description: 'Reconstruct R code from the static slice',
		processor:   input => reconstructToCode(...input),
		required:    'once-per-slice',
	} as ISubStep<typeof reconstructToCode>
} as const

export const STEPS = { ...STEPS_PER_FILE, ...STEPS_PER_SLICE } as const

export type SubStepName = keyof typeof STEPS
export type SubStep<name extends SubStepName> = typeof STEPS[name]
export type SubStepProcessor<name extends SubStepName> = SubStep<name>['processor']

export function doSubStep<Name extends SubStepName, Processor extends SubStepProcessor<Name>>(subStep: Name, ...input: Parameters<Processor>[0]): ReturnType<Processor> {
	return STEPS[subStep].processor(input as never) as ReturnType<Processor>
}

