import { IStep, NameOfStep } from '../step'
import { verifyAndBuildPipeline } from './dependency-checker'

/**
 * A pipeline is a collection of {@link Pipeline#steps|steps} that are executed in a certain {@link Pipeline#order|order}.
 * It is to be created {@link createPipeline}.
 */
export interface Pipeline {
	readonly steps: ReadonlyMap<NameOfStep, IStep>
	readonly order: NameOfStep[]
}

/**
 * Creates a pipeline from the given steps.
 * Refer to {@link verifyAndBuildPipeline} for details and constraints on the steps.
 */
export function createPipeline(steps: IStep[]): Pipeline {
	return verifyAndBuildPipeline(steps)
}
