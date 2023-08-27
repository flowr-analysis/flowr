/**
 * This file defines *all* steps of the slicing process and the data they require.
 */
import { MergeableRecord } from '../util/objects'
import { decorateAst, normalize, retrieveXmlFromRCode } from '../r-bridge'
import { produceDataFlowGraph } from '../dataflow'
import { convertAllSlicingCriteriaToIds, reconstructToCode, staticSlicing } from '../slicing'

/**
 * The names of all main steps of the slicing process.
 */
export const STEP_NAMES = ['parse', 'normalize', 'decorate', 'dataflow', 'slice', 'reconstruct'] as const

type StepFunction = (...args: never[]) => unknown

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
	required:    'once-per-file' | 'once-per-slice'
}

// type Steps= { [ K in 'parse' ]: Step<K> }
// TODO: update the benchmark slicer accordingly
// TODO: allow to append a *formatter* that can produce text/mermaid etc. output from the result for each step
/**
 * note, that the order of elements here also describes the order of their desired execution
 */
const steps = {
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
	} as ISubStep<typeof produceDataFlowGraph>,
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

/*
export type SubStepName = typeof steps[number]['name']
export type SubStep<name extends SubStepName> = Extract<typeof steps[number], { name: name }>

export function doSubStep<Name extends SubStepName, Step extends SubStep<Name>, Fn extends Step['processor']>(subStep: Name, input: Parameters<Fn>): ReturnType<Fn> {
	return subStep.processor(input)
}

const test = doSubStep('parse', {})


// TODO: use undefined for default

export function getResultOfSteps<InterestedIn extends(typeof STEP_NAMES[number])[], Output>(steps: InterestedIn): Output {
}
*/
