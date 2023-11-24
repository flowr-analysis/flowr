import { IStep, NameOfStep } from '../step'
import { verifyAndBuildPipeline } from './create'

/**
 * A pipeline is a collection of {@link Pipeline#steps|steps} that are executed in a certain {@link Pipeline#order|order}.
 * It is to be created {@link createPipeline}.
 *
 * If you want to get the type of all steps in the pipeline (given they are created canonically using const step names), refer to {@link PipelineStepNames}.
 */
export interface Pipeline<T extends IStep = IStep> {
	readonly steps:               ReadonlyMap<NameOfStep, IStep>
	readonly order:               T['name'][]
	/**
	 * In the order, this is the index of the first step that
	 * is executed {@link StepHasToBeExecuted#OncePerRequest|once per request}.
	 * If undefined, all steps are executed {@link StepHasToBeExecuted#OncePerFile|once per file}.
	 */
	readonly firstStepPerRequest: number | undefined
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

export type PipelineInput<P extends Pipeline> = PipelineStep<P>['requiredInput']
export type PipelineOutput<P extends Pipeline> = {
	[K in PipelineStepNames<P>]: PipelineStepResultWithName<P, K>
}

/**
 * Creates a pipeline from the given steps.
 * Refer to {@link verifyAndBuildPipeline} for details and constraints on the steps.
 */
export function createPipeline<T extends readonly IStep[]>(...steps: T): Pipeline<T[number]> {
	return verifyAndBuildPipeline(steps)
}
