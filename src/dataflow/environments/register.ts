import { cloneEnvironments, IdentifierDefinition, IEnvironment, REnvironmentInformation } from './environment'
import { DataflowScopeName, GlobalScope, LocalScope } from '../graph'

/**
 * Insert the given `definition` --- defined within the given scope --- into the passed along `environments` will take care of propagation.
 * Does not modify the passed along `environments` in-place! It returns the new reference.
 */
export function define(definition: IdentifierDefinition, withinScope: DataflowScopeName, environments: REnvironmentInformation): REnvironmentInformation {
  let newEnvironments = environments
  if(withinScope === LocalScope) {
    newEnvironments = cloneEnvironments(environments, false)
    newEnvironments.current.memory.set(definition.name, [definition])
  } else if (withinScope === GlobalScope) {
    newEnvironments = cloneEnvironments(environments, true)
    let current: IEnvironment | undefined = newEnvironments.current
    do {
      current.memory.set(definition.name, [definition])
      current = current.parent
    } while (current !== undefined)
  }
  return newEnvironments
}
