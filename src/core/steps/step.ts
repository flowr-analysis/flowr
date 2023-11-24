/**
 * Defines the {@link IStep} interface which specifies all data available for a single step.
 *
 * @module
 */

import { MergeableRecord } from '../../util/objects'
import { InternalStepPrinter, IStepPrinter, StepOutputFormat } from '../print/print'


/**
 * This represents close a function that we know completely nothing about.
 * Nevertheless, this is the basis of what a step processor should look like.
 */
export type StepFunction = (...args: never[]) => unknown
/**
 * This represents the required execution frequency of a step.
 */
export type StepRequired = 'once-per-file' | 'once-per-slice'


export type NameOfStep = string & { __brand?: 'StepName' }

/**
 * Contains the data to specify the order of {@link IStep|steps} in a pipeline.
 */
export interface IStepOrder {
	/**
	 * Name of the respective step, it does not have to be unique in general but only unique per-pipeline.
	 * In other words, you can have multiple steps with a name like `parse` as long as you use only one of them in a given pipeline.
	 * This is, because these names are required in the {@link IStep#dependencies} field to refer to other steps this one relies on.
	 */
	readonly name:         string
	/**
	 * Give the names of other steps this one requires to be completed as a prerequisite (e.g., to gain access to their input).
	 * Does not have to be transitive, this will be checked by the scheduler of the pipeline.
	 */
	readonly dependencies: readonly NameOfStep[]
	/**
	 * This is similar to {@link dependencies}, but is used to say that a given step _decorates_ another one.
	 * This imbues two requirements:
	 * The step must take the output of the decorated step as input, and produce the same output as the decorated step.
	 *
	 * If so, it is ensured that _this_ step is executed _after_ the step it decorates, but before any step that depends on it.
	 */
	readonly decorates?:   NameOfStep
}

/**
 * Defines what is to be known of a single step in the slicing process.
 * It wraps around a single {@link IStep#processor|processor} function, providing additional information.
 * Steps will be executed synchronously, in-sequence, based on their {@link IStep#dependencies|dependencies}.
 */
export interface IStep<
	// eslint-disable-next-line -- by default, we assume nothing about the function shape
	Fn extends StepFunction = (...args: any[]) => any,
> extends MergeableRecord, IStepOrder {
	/** Human-readable description of this step */
	readonly description: string
	/** The main processor that essentially performs the logic of this step */
	readonly processor:   (...input: Parameters<Fn>) => ReturnType<Fn>
	/* does this step has to be repeated for each new slice or can it be performed only once in the initialization */
	readonly required:    StepRequired
	/**
	 * How to visualize the results of the respective step to the user?
	 */
	readonly printer: {
		[K in StepOutputFormat]?: Readonly<IStepPrinter<Fn, K, never[]>>
	} & {
		// we always want to have the internal printer
		[StepOutputFormat.Internal]: Readonly<InternalStepPrinter<Fn>>
	}
}



