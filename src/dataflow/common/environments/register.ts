import { guard } from '../../../util/assert'
import type { IdentifierDefinition, IEnvironment, REnvironmentInformation } from './environment'
import { cloneEnvironments } from './environment'

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
export function define(definition: IdentifierDefinition, superAssign: boolean, environments: REnvironmentInformation): REnvironmentInformation {
	let newEnvironments = environments
	if(superAssign) {
		newEnvironments = cloneEnvironments(environments, true)
		let current: IEnvironment | undefined = newEnvironments.current
		let last = undefined
		let found = false
		do{
			if(current.memory.has(definition.name)) {
				current.memory.set(definition.name, [definition])
				found = true
				break
			}
			last = current
			current = current.parent
		} while(current !== undefined)
		if(!found) {
			guard(last !== undefined, () => `Could not find global scope for ${definition.name}`)
			last.memory.set(definition.name, [definition])
		}
	} else {
		newEnvironments = cloneEnvironments(environments, false)
		defInEnv(newEnvironments.current, definition)
	}
	return newEnvironments
}
