import { IStep, NameOfStep, StepHasToBeExecuted } from '../step'
import { InvalidPipelineError } from './invalid-pipeline-error'
import { Pipeline } from './pipeline'
import { jsonReplacer } from '../../../util/json'
import { partitionArray } from '../../../util/arrays'

/**
 * Given a set of {@link IStep|steps} with their dependencies, this function verifies that
 * 0) the pipeline is not empty
 * 1) all names of steps are unique for the given pipeline
 * 2) all {@link IStepOrder#dependencies|dependencies} of all steps are exist
 * 3) there are no cycles in the dependency graph
 * 4) the target of a {@link IStepOrder#decorates|decoration} exists
 * 5) if a decoration applies, all of its dependencies are already in the pipeline
 * 6) in the resulting pipeline, there is a strict cut between steps that are executed once per file and once per request
 * If successful, it returns the topologically sorted list of steps in order of desired execution.
 * @throws InvalidPipelineError if any of the above conditions are not met
 */
export function verifyAndBuildPipeline(steps: readonly IStep[]): Pipeline {
	if(steps.length === 0) {
		throw new InvalidPipelineError('0) Pipeline is empty')
	}

	const [perFileSteps, perRequestSteps] = partitionArray(steps, s => s.executed === StepHasToBeExecuted.OncePerFile)

	// we construct a map linking each name to its respective step
	const perFileStepMap = new Map<NameOfStep, IStep>()
	const initsPerFile: NameOfStep[] = []
	const visited = new Set<NameOfStep>()

	// we start by working on the per-file steps
	initializeSteps(perFileSteps, perFileStepMap, initsPerFile, visited)
	// first, we sort the per-file steps
	const sortedPerFile = topologicalSort(initsPerFile, perFileStepMap, visited)
	validateMaps(sortedPerFile, perFileStepMap, steps)

	const perRequestStepMap = new Map<NameOfStep, IStep>()
	// we track all elements without dependencies, i.e., those that start the pipeline
	const initsPerRequest: NameOfStep[] = []

	// now, we do the same for the per-request steps, keeping the per-file steps known
	initializeSteps(perRequestSteps, perRequestStepMap, initsPerRequest, visited)

	const allStepsMap = new Map([...perFileStepMap, ...perRequestStepMap])
	const sortedPerRequest = topologicalSort(initsPerRequest, allStepsMap, visited)

	validateMaps(sortedPerRequest, perRequestStepMap, steps)

	return {
		steps:               allStepsMap,
		order:               [...sortedPerFile, ...sortedPerRequest],
		firstStepPerRequest: sortedPerRequest.length === 0 ? undefined : sortedPerFile.length
	}
}

function validateMaps(sorted: NameOfStep[], stepMap: Map<NameOfStep, IStep>, steps: readonly IStep[]) {
	if(sorted.length !== stepMap.size) {
		// check if any of the dependencies in the map are invalid
		checkForInvalidDependency(steps, stepMap)
		// otherwise, we assume a cycle
		throw new InvalidPipelineError(`3) Pipeline contains at least one cycle; sorted: ${JSON.stringify(sorted)}, steps: ${JSON.stringify([...stepMap.keys()])}`)
	}
}

function allDependenciesAreVisited(step: IStep, visited: Set<NameOfStep>) {
	return step.dependencies.every(d => visited.has(d))
}

function handleStep(step: IStep, init: NameOfStep, visited: Set<NameOfStep>, sorted: NameOfStep[], elem: NameOfStep, decoratorsOfLastOthers: Set<NameOfStep>, inits: NameOfStep[]) {
	if(step.decorates === init) {
		if(allDependenciesAreVisited(step, visited)) {
			sorted.push(elem)
			visited.add(elem)
		} else {
			decoratorsOfLastOthers.add(elem)
		}
	} else if(step.decorates === undefined && allDependenciesAreVisited(step, visited)) {
		inits.push(elem)
	}
}

function topologicalSort(inits: NameOfStep[], stepMap: Map<NameOfStep, IStep>, visited: Set<NameOfStep>) {
	const sorted: NameOfStep[] = []

	while(inits.length > 0) {
		const init = inits.pop() as NameOfStep
		sorted.push(init)
		visited.add(init)

		// these decorators still have dependencies open; we have to check if they can be satisfied by the other steps to add
		const decoratorsOfLastOthers = new Set<NameOfStep>()
		for(const [elem, step] of stepMap.entries()) {
			if(visited.has(elem)) {
				continue
			}
			handleStep(step, init, visited, sorted, elem, decoratorsOfLastOthers, inits)
		}

		// for the other decorators we have to cycle until we find a solution, or know, that no solution exists
		topologicallyInsertDecoratorElements(decoratorsOfLastOthers, stepMap, visited, sorted)
	}
	return sorted
}

function topologicallyInsertDecoratorElements(decoratorsOfLastOthers: Set<NameOfStep>, stepMap: Map<NameOfStep, IStep>, visited: Set<NameOfStep>, sorted: NameOfStep[]) {
	if(decoratorsOfLastOthers.size === 0) {
		return
	}

	let changed = true
	while(changed) {
		changed = false
		for(const elem of [...decoratorsOfLastOthers]) {
			const step = stepMap.get(elem) as IStep
			if(allDependenciesAreVisited(step, visited)) {
				decoratorsOfLastOthers.delete(elem)
				sorted.push(elem)
				visited.add(elem)
				changed = true
			}
		}
	}
	if(decoratorsOfLastOthers.size > 0) {
		throw new InvalidPipelineError(`5) Pipeline contains at least one decoration cycle: ${JSON.stringify(decoratorsOfLastOthers, jsonReplacer)}`)
	}
}

function checkForInvalidDependency(steps: readonly IStep[], stepMap: Map<NameOfStep, IStep>) {
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

function initializeSteps(steps: readonly IStep[], stepMap: Map<NameOfStep, IStep>, inits: NameOfStep[], visited: Set<NameOfStep>) {
	for(const step of steps) {
		const name = step.name
		// if the name is already in the map we have a duplicate
		if(stepMap.has(name)) {
			throw new InvalidPipelineError(`1) Step name "${name}" is not unique in the pipeline`)
		}
		stepMap.set(name, step)
		// only steps that have no dependencies and do not decorate others can be initial steps
		if(allDependenciesAreVisited(step, visited) && (step.decorates === undefined || visited.has(step.decorates))) {
			inits.push(name)
		}
	}
}

