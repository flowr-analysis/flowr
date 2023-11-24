import { IStep, NameOfStep } from '../step'
import { verifyAndBuildPipeline } from './dependency-checker'

/**
 * A pipeline is a collection of {@link Pipeline#steps|steps} that are executed in a certain {@link Pipeline#order|order}.
 * It is to be created {@link createPipeline}.
 *
 * If you want to get the type of all steps in the pipeline (given they are created canonically using const step names), refer to {@link PipelineStepTypes}.
 */
export interface Pipeline<T extends NameOfStep[] = NameOfStep[]> {
	readonly steps: ReadonlyMap<NameOfStep, IStep>
	readonly order: T
}

/**
 * Returns the types of all steps in the given pipeline.
 *
 * @see Pipeline for details
 */
export type PipelineStepTypes<T extends Pipeline> = T extends Pipeline<infer U> ? U[0] : never

/**
 * Creates a pipeline from the given steps.
 * Refer to {@link verifyAndBuildPipeline} for details and constraints on the steps.
 */
export function createPipeline<T extends readonly IStep[]>(...steps: T): Pipeline<T[number]['name'][]> {
	return verifyAndBuildPipeline(steps)
}
