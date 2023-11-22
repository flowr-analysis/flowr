import { IStep, StepName } from '../step'
import { InvalidPipelineError } from './invalid-pipeline-error'
import { Pipeline } from './pipeline'


/**
 * Given a set of {@link IStep|steps} with their dependencies, this function verifies that
 * 1) all names of steps are unique for the given pipeline
 * 2) all dependencies of steps are valid (i.e., refer to existing steps)
 * 3) there are no cycles in the dependency graph
 * If successful, it returns the topologically sorted list of steps in order of desired execution.
 */
export function verifyPipeline(steps: IStep[]): Pipeline {
	// we construct a map linking each name to its respective step
	const stepMap = new Map<StepName, IStep>()
	// we track all elements without dependencies, i.e. those that start the pipeline
	const inits: StepName[] = []
	initializeSteps(steps, stepMap, inits)

	if(inits.length === 0) {
		throw new InvalidPipelineError('Pipeline has no initial steps (i.e., it contains no step without dependencies)')
	}
	const sorted = topoSort(inits, stepMap)

	if(sorted.length !== stepMap.size) {
		// check if any of the dependencies in the map are invalid
		checkForInvalidDependency(steps, stepMap)
		// otherwise, we assume a cycle
		throw new InvalidPipelineError('Pipeline contains at least one cycle')
	}

	return {
		steps: stepMap,
		order: sorted
	}
}

function topoSort(inits: StepName[], stepMap: Map<StepName, IStep>) {
	// now, we topo-sort the steps
	const sorted: StepName[] = []
	const visited = new Set<StepName>()
	while(inits.length > 0) {
		const init = inits.pop() as StepName
		sorted.push(init)
		visited.add(init)
		// TODO: improve this check, maybe really remove?
		for(const [key, step] of stepMap.entries()) {
			if(!visited.has(key) && step.dependencies.filter(dep => !visited.has(dep)).length === 0) {
				inits.push(key)
			}
		}
	}
	return sorted
}

function checkForInvalidDependency(steps: IStep[], stepMap: Map<StepName, IStep>) {
	for(const step of steps) {
		for(const dep of step.dependencies) {
			if(!stepMap.has(dep)) {
				throw new InvalidPipelineError(`Step "${step.name}" depends on step "${dep}" which does not exist`)
			}
		}
	}
}

function initializeSteps(steps: IStep[], stepMap: Map<StepName, IStep>, inits: StepName[]) {
	for(const step of steps) {
		const name = step.name
		// if the name is already in the map we have a duplicate
		if(stepMap.has(name)) {
			throw new InvalidPipelineError(`Step name "${name}" is not unique in the pipeline`)
		}
		stepMap.set(name, step)
		if(step.dependencies.length === 0) {
			inits.push(name)
		}
	}
}

