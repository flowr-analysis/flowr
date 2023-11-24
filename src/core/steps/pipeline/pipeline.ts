import { IStep, NameOfStep } from '../step'
import { verifyAndBuildPipeline } from './dependency-checker'
import { StepName } from '../steps'

/**
 * A pipeline is a collection of {@link Pipeline#steps|steps} that are executed in a certain {@link Pipeline#order|order}.
 * It is to be created {@link createPipeline}.
 *
 * If you want to get the type of all steps in the pipeline (given they are created canonically using const step names), refer to {@link PipelineStepNames}.
 *
 * TODO: group this for per-file and per-request steps/stages in general with arbitrary names?
 */
export interface Pipeline<T extends IStep = IStep> {
	readonly steps: ReadonlyMap<NameOfStep, IStep>
	readonly order: T['name'][]
}

/**
 * Returns the types of all step names in the given pipeline.
 *
 * @see Pipeline for details
 */
export type PipelineStepNames<P extends Pipeline> = PipelineStep<P>['name']
export type PipelineStep<P extends Pipeline> = P extends Pipeline<infer U> ? U : never

export type PipelineStepWithName<P extends Pipeline, Name extends NameOfStep> = P extends Pipeline<infer U> ? U extends IStep<Name> ? U : never : never
export type PipelineStepProcessorWithName<P extends Pipeline, Name extends NameOfStep> = PipelineStepWithName<P, Name>['processor']
export type PipelineStepPrintersWithName<P extends Pipeline, Name extends NameOfStep> = PipelineStepWithName<P, Name>['printer']
export type PipelineStepResultWithName<P extends Pipeline, Name extends NameOfStep> = Awaited<ReturnType<PipelineStepProcessorWithName<P, Name>>>

/**
 * Creates a pipeline from the given steps.
 * Refer to {@link verifyAndBuildPipeline} for details and constraints on the steps.
 */
export function createPipeline<T extends readonly IStep[]>(...steps: T): Pipeline<T[number]> {
	return verifyAndBuildPipeline(steps)
}
