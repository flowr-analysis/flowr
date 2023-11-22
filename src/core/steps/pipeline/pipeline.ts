import { IStep, StepName } from '../step'

export interface Pipeline {
	readonly steps: ReadonlyMap<StepName, IStep>
	readonly order: StepName[]
}
