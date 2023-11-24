import { IStep, NameOfStep } from '../step'
import { InvalidPipelineError } from './invalid-pipeline-error'
import { Pipeline } from './pipeline'


/**
 * Given a set of {@link IStep|steps} with their dependencies, this function verifies that
 * 0) the pipeline is not empty
 * 1) all names of steps are unique for the given pipeline
 * 2) all {@link IStepOrder#dependencies|dependencies} of steps are valid (i.e., refer to existing steps)
 * 3) there are no cycles in the dependency graph
 * 4) the target of a {@link IStepOrder#decorates|decoration} exists
 * 5) if a decoration applies, all of its dependencies are already in the pipeline
 * If successful, it returns the topologically sorted list of steps in order of desired execution.
 * @throws InvalidPipelineError if any of the above conditions are not met
 */
export function verifyAndBuildPipeline(steps: IStep[]): Pipeline {
	if(steps.length === 0) {
		throw new InvalidPipelineError('0) Pipeline is empty')
	}

	// we construct a map linking each name to its respective step
	const stepMap = new Map<NameOfStep, IStep>()
	// we track all elements without dependencies, i.e., those that start the pipeline
	const inits: NameOfStep[] = []
	initializeSteps(steps, stepMap, inits)

	if(inits.length === 0) {
		throw new InvalidPipelineError('3) Pipeline has no initial steps (i.e., it contains no step without dependencies)')
	}
	const sorted = topologicalSort(inits, stepMap)

	if(sorted.length !== stepMap.size) {
		// check if any of the dependencies in the map are invalid
		checkForInvalidDependency(steps, stepMap)
		// otherwise, we assume a cycle
		throw new InvalidPipelineError('3) Pipeline contains at least one cycle')
	}

	return {
		steps: stepMap,
		order: sorted
	}
}

function topologicalSort(inits: NameOfStep[], stepMap: Map<NameOfStep, IStep>) {
	// now, we topo-sort the steps
	const sorted: NameOfStep[] = []
	const unvisited = new Set(stepMap.keys())
	while(inits.length > 0) {
		const init = inits.pop() as NameOfStep
		sorted.push(init)
		unvisited.delete(init)
		const last = sorted[sorted.length - 1]

		for(const elem of unvisited) {
			const step = stepMap.get(elem) as IStep
			// we should do that better, for now we do not assume that many dependencies
			const hasUnsatisfiedDependencies = step.dependencies.some(dep => unvisited.has(dep))

			// if the step decorates the last step in the sorted list, we can add it to the list, but only if all its dependencies are already in the list
			if(step.decorates === last) {
				// if dependencies are still missing, we cannot add it to the list and fail TODO: if not all of its dependencies which remain decorate the last step
				// TODO: we currently do not allow decorations to be dependent on each other for the same step
				if(hasUnsatisfiedDependencies) {
					throw new InvalidPipelineError(`5) Step "${step.name}" decorates step "${step.decorates}" but not all of its dependencies are satisfied`)
				}
				sorted.push(elem)
				unvisited.delete(elem)
			} else if(hasUnsatisfiedDependencies) {
				inits.push(elem)
			}
		}
	}
	return sorted
}

function checkForInvalidDependency(steps: IStep[], stepMap: Map<NameOfStep, IStep>) {
	for(const step of steps) {
		for(const dep of step.dependencies) {
			if(!stepMap.has(dep)) {
				throw new InvalidPipelineError(`2) Step "${step.name}" depends on step "${dep}" which does not exist`)
			}
		}
		if(step.decorates && !stepMap.has(step.decorates)) {
			throw new InvalidPipelineError(`4) Step "${step.name}" decorates step "${step.decorates}" which does not exist`)
		}
	}
}

function initializeSteps(steps: IStep[], stepMap: Map<NameOfStep, IStep>, inits: NameOfStep[]) {
	for(const step of steps) {
		const name = step.name
		// if the name is already in the map we have a duplicate
		if(stepMap.has(name)) {
			throw new InvalidPipelineError(`1) Step name "${name}" is not unique in the pipeline`)
		}
		stepMap.set(name, step)
		if(step.dependencies.length === 0) {
			inits.push(name)
		}
	}
}

