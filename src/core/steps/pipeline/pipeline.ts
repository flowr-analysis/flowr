import type { IPipelineStep, PipelineStepName, PipelineStepStage } from '../pipeline-step';
import { verifyAndBuildPipeline } from './create-pipeline';
import type { DeepReadonly, UnionToIntersection } from 'ts-essentials';

/**
 * A pipeline is a collection of {@link Pipeline#steps|steps} that are executed in a certain {@link Pipeline#order|order}.
 * It is to be created {@link createPipeline}.
 *
 * If you want to get the type of all steps in the pipeline (given they are created canonically using const step names), refer to {@link PipelineStepNames}.
 */
export interface Pipeline<T extends IPipelineStep = IPipelineStep> {
	readonly steps:               ReadonlyMap<PipelineStepName, DeepReadonly<IPipelineStep>>
	readonly order:               readonly T['name'][]
	/**
	 * In the order, this is the index of the first step that
	 * is executed {@link PipelineStepStage#OncePerRequest|once per request}.
	 * If it is "out of bounds" (i.e., the number of steps), all steps are executed {@link PipelineStepStage#OncePerFile|once per file}.
	 */
	readonly firstStepPerRequest: number
}

/**
 * Returns the types of all step names in the given pipeline.
 *
 * @see Pipeline for details
 */
export type PipelineStepNames<P extends Pipeline> = PipelineStep<P>['name']
/**
 * Returns the steps included in the given pipeline.
 * @example
 * ```ts
 * type Pipeline = typeof DEFAULT_DATAFLOW_PIPELINE
 * // Pipeline is now Pipeline<step1 | step2 | ...>
 * type Steps = PipelineStep<typeof DEFAULT_DATAFLOW_PIPELINE>
 * // Steps is now just step1 | step2 | ...
 * ```
 */
export type PipelineStep<P extends Pipeline> = P extends Pipeline<infer U> ? U : never

/**
 * Meta-information attached to every step result
 */
export interface PipelinePerStepMetaInformation {
	readonly '.meta': {
		/**
		 * The time it took to execute the step in milliseconds,
		 * the required accuracy is dependent on the measuring system, but usually at around 1 ms.
		 */
		readonly timing: number
	}
}

/**
 * Returns the step with the given name from the given pipeline.
 *
 * @example
 * ```ts
 * type Foo = PipelineStepWithName<typeof DEFAULT_DATAFLOW_PIPELINE, 'parse'>
 * // Foo is now only the "parse" step from the DEFAULT_DATAFLOW_PIPELINE
 * ```
 */
export type PipelineStepWithName<P extends Pipeline, Name extends PipelineStepName> = P extends Pipeline<infer U> ? U extends IPipelineStep<Name> ? U : never : never
/**
 * Returns the processor function of the step with the given name from the given pipeline.
 * @see {@link PipelineStepWithName}
 */
export type PipelineStepProcessorWithName<P extends Pipeline, Name extends PipelineStepName> = PipelineStepWithName<P, Name>['processor']
/**
 * Returns the printer function of the step with the given name from the given pipeline.
 * @see {@link PipelineStepWithName}
 */
export type PipelineStepPrintersWithName<P extends Pipeline, Name extends PipelineStepName> = PipelineStepWithName<P, Name>['printer']
/**
 * Returns the output type of the step with the given name from the given pipeline.
 *
 * @example
 * ```ts
 * type Foo = PipelineStepOutputWithName<typeof DEFAULT_DATAFLOW_PIPELINE, 'parse'>
 * // Foo contains the ParseStepOutput & PipelinePerStepMetaInformation type (ie the parse output and meta information)
 * @see {@link PipelineStepWithName}
 * ```
 */
export type PipelineStepOutputWithName<P extends Pipeline, Name extends PipelineStepName> = Awaited<ReturnType<PipelineStepProcessorWithName<P, Name>>> & PipelinePerStepMetaInformation
/**
 * Returns a union type that represents the required inputs to be passed to the given pipeline.
 *
 * @example
 * ```ts
 * type Foo = PipelineInput<typeof DEFAULT_DATAFLOW_PIPELINE>
 * // Foo contains ParseRequiredInput & NormalizeRequiredInput
 * ```
 * 
 * In short, this can be useful whenever you want to describe _all_ inputs a complete
 * pipeline needs to run through (i.e., the union of all inputs required by the individual steps).
 *
 * @see {@link PipelineOutput}
 */
export type PipelineInput<P extends Pipeline> = UnionToIntersection<PipelineStep<P>['requiredInput']>

/**
 * Only gets the union of 'requiredInput' of those PipelineSteps which have a 'execute' field of type 'OncePerRequest'.
 * In other words, information that you may want to change for another request (e.g., another slice) with the same file.
 */
export type PipelinePerRequestInput<P extends Pipeline> = {
	[K in PipelineStepNames<P>]: PipelineStepWithName<P, K>['executed'] extends PipelineStepStage.OncePerFile ? never : PipelineStepWithName<P, K>['requiredInput']
}[PipelineStepNames<P>]


/**
 * Returns an object type that represents the types of the outputs that will result from running the given pipeline, each as the step's name mapped to its PipelineStepOutputWithName.
 * @example
 * ```ts
 * type Foo = PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>
 * // Foo contains {
 * //   parse: ParseStepOutput & PipelinePerStepMetaInformation,
 * //   normalize: NormalizeStepOutput & PipelinePerStepMetaInformation,
 * //   ...
 * // }
 * ```
 */
export type PipelineOutput<P extends Pipeline> = {
	[K in PipelineStepNames<P>]: PipelineStepOutputWithName<P, K>
}

/**
 * Creates a {@link Pipeline|pipeline} from a given collection of {@link IPipelineStep|steps}.
 * To be valid, the collection of {@link IPipelineStep|steps} must satisfy the following set of constraints
 * (which should be logical, when you consider what a pipeline should achieve):
 *
 * 0) the collection of {@link IPipelineStep|steps} is not empty
 * 1) all {@link IPipelineStepOrder#name|names} of {@link IPipelineStep|steps} are unique for the given pipeline
 * 2) all {@link IPipelineStepOrder#dependencies|dependencies} of all {@link IPipelineStep|steps} exist
 * 3) there are no cycles in the dependency graph
 * 4) the target of a {@link IPipelineStepOrder#decorates|step's decoration} exists
 * 5) if a {@link IPipelineStepOrder#decorates|decoration} applies, all of its {@link IPipelineStepOrder#dependencies|dependencies} are already in the pipeline
 * 6) in the resulting {@link Pipeline|pipeline}, there is a strict cut between {@link IPipelineStep|steps} that are executed
 * 		{@link PipelineStepStage#OncePerFile|once per file} and {@link PipelineStepStage#OncePerRequest|once per request}.
 *
 * @returns The function will try to order your collection steps so that all the constraints hold.
 * If it succeeds it will return the resulting {@link Pipeline|pipeline}, otherwise it will throw an {@link InvalidPipelineError}.
 *
 * @throws InvalidPipelineError If any of the constraints listed above are not satisfied.
 */
export function createPipeline<T extends readonly IPipelineStep[]>(...steps: T): Pipeline<T[number]> {
	return verifyAndBuildPipeline(steps);
}
