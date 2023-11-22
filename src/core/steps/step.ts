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


export type StepName = string & { __brand?: 'StepName' }

/**
 * Defines what is to be known of a single step in the slicing process.
 * It wraps around a single {@link IStep#processor|processor} function, providing additional information.
 * Steps will be executed synchronously, in-sequence, based on their {@link IStep#dependencies|dependencies}.
 */
export interface IStep<
	Fn extends StepFunction = StepFunction,
> extends MergeableRecord {
	/**
	 * Name of the respective step, it does not have to be unique in general but only unique per-pipeline.
	 * In other words, you can have multiple steps with a name like `parse` as long as you use only one of them in a given pipeline.
	 * This is, because these names are required in the {@link IStep#dependencies} field to refer to other steps this one relies on.
	 */
	name:        StepName
	/** Human-readable description of this step */
	description: string
	/** The main processor that essentially performs the logic of this step */
	processor:   (...input: Parameters<Fn>) => ReturnType<Fn>
	/* does this step has to be repeated for each new slice or can it be performed only once in the initialization */
	required:    StepRequired
	/**
	 * How to visualize the results of the respective step to the user?
	 */
	printer: {
		[K in StepOutputFormat]?: IStepPrinter<Fn, K, never[]>
	} & {
		// we always want to have the internal printer
		[StepOutputFormat.Internal]: InternalStepPrinter<Fn>
	}
	/**
	 * Give the names of other steps this one requires to be completed as a prerequisite (e.g., to gain access to their input).
	 * Does not have to be transitive, this will be checked by the scheduler of the pipeline.
	 */
	dependencies: StepName[]
}



