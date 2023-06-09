import { IdentifierDefinition, REnvironmentInformation } from './environment'
import { DataflowScopeName, GlobalScope, LocalScope } from '../graph'

/**
 * Insert the given `definition` --- defined within the given scope --- into the passed along `environments` will take care of propagation.
 * Modifies the passed along `environments` in-place. It returns the same reference for ease of use.
 */
export function define(definition: IdentifierDefinition, withinScope: DataflowScopeName, environments: REnvironmentInformation): REnvironmentInformation {
  if(withinScope === LocalScope) {
    environments.local[0].memory.set(definition.name, [definition])
  } else if (withinScope === GlobalScope) {
    environments.global.memory.set(definition.name, [definition])
    // TODO: really overwrite all locals on the way as well?
    environments.local.forEach(e => e.memory.set(definition.name, [definition]))
  }
  return environments
}
