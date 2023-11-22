import { IStep } from './step'

/**
 * A pipeline describes a sequence of steps that are to be executed in order.
 */
// TODO: stepping slicer is repsonsible!
export type IPipeline = IStep<any>[]
