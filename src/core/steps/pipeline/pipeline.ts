import { IStep, NameOfStep } from '../step'
import { verifyAndBuildPipeline } from './dependency-checker'

/**
 * A pipeline is a collection of {@link Pipeline#steps|steps} that are executed in a certain {@link Pipeline#order|order}.
 * It is to be created {@link createPipeline}.
 */
export interface Pipeline<T extends NameOfStep[] = NameOfStep[]> {
	readonly steps: ReadonlyMap<NameOfStep, IStep>
	readonly order: T
}

/**
 * Creates a pipeline from the given steps.
 * Refer to {@link verifyAndBuildPipeline} for details and constraints on the steps.
 */
export function createPipeline<T extends readonly IStep[]>(...steps: T): Pipeline<T[number]['name'][]> {
	return verifyAndBuildPipeline(steps)
}
