import { IStep, NameOfStep } from '../step'
import { verifyAndBuildPipeline } from './dependency-checker'

export interface Pipeline {
	readonly steps: ReadonlyMap<NameOfStep, IStep>
	readonly order: NameOfStep[]
}

export function createPipeline(steps: IStep[]): Pipeline {
	return verifyAndBuildPipeline(steps)
}
