import { SubStepName, SubStepProcessor } from './steps'

/** Just so that the type is more readable */
type Empty = Record<string, never>

/** Represents the return value of the processor linked to the (sub-)step with the name 'K' */
type Out<K extends SubStepName> = Record<K, Awaited<ReturnType<SubStepProcessor<K>>>>;

/**
 * Essentially expresses an object that, if a step 'x' is of interest, contains the result of step 'x' and all steps before 'x'.
 */
export type StepResults<InterestedIn extends SubStepName> = InterestedIn extends never ? Empty : {
	'parse':           Out<'parse'>
	'normalize ast':   StepResults<'parse'> & Out<'normalize ast'>
	'decorate':        StepResults<'normalize ast'> & Out<'decorate'>
	'dataflow':        StepResults<'decorate'> & Out<'dataflow'>
	'decode criteria': StepResults<'dataflow'> & Out<'decode criteria'>
	'slice':           StepResults<'decode criteria'> & Out<'slice'>
	'reconstruct':     StepResults<'slice'> & Out<'reconstruct'>
}[InterestedIn]

