import { cloneEnvironments, IdentifierDefinition, IEnvironment, REnvironmentInformation } from './environment'
import { DataflowScopeName, GlobalScope, LocalScope } from './scopes'

function defInEnv(newEnvironments: IEnvironment, definition: IdentifierDefinition) {
	const existing = newEnvironments.memory.get(definition.name)
	// check if it is maybe or not
	if(existing === undefined || definition.used === 'always') {
		newEnvironments.memory.set(definition.name, [definition])
	} else {
		existing.push(definition)
	}
}

/**
 * Insert the given `definition` --- defined within the given scope --- into the passed along `environments` will take care of propagation.
 * Does not modify the passed along `environments` in-place! It returns the new reference.
 */
export function define(definition: IdentifierDefinition, withinScope: DataflowScopeName, environments: REnvironmentInformation): REnvironmentInformation {
	let newEnvironments = environments
	if(withinScope === LocalScope) {
		newEnvironments = cloneEnvironments(environments, false)
		defInEnv(newEnvironments.current, definition)
	} else if(withinScope === GlobalScope) {
		newEnvironments = cloneEnvironments(environments, true)
		let current: IEnvironment | undefined = newEnvironments.current
		do{
			defInEnv(current, definition)
			current = current.parent
		} while(current !== undefined)
	}
	return newEnvironments
}
