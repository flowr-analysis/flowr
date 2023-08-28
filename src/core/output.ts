import { SubStepName, SubStepProcessor } from './steps'

/** Represents the return value of the processor linked to the (sub-)step with the name 'K' */
type Out<K extends SubStepName> = Record<K, Awaited<ReturnType<SubStepProcessor<K>>>>;

/**
 * Essentially expresses an object that, if a step 'x' is of interest, contains the result of step 'x' and all steps before 'x'.
 */
export type StepResults<InterestedIn extends SubStepName | undefined> = InterestedIn extends never ? never
	: InterestedIn extends undefined ? StepResultsHelper<'reconstruct'>
		: StepResultsHelper<Exclude<InterestedIn, undefined>>

type StepResultsHelper<InterestedIn extends SubStepName> = {
	'parse':       Out<'parse'>
	'normalize':   StepResults<'parse'> & Out<'normalize'>
	'dataflow':    StepResults<'normalize'> & Out<'dataflow'>
	'slice':       StepResults<'dataflow'> & Out<'slice'>
	'reconstruct': StepResults<'slice'> & Out<'reconstruct'>
}[InterestedIn]

