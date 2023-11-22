import { IStep, NameOfStep } from '../step'

export interface Pipeline {
	readonly steps: ReadonlyMap<NameOfStep, IStep>
	readonly order: NameOfStep[]
}
