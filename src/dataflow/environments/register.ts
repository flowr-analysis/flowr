import { IdentifierDefinition, IEnvironment, REnvironmentInformation } from './environment'
import { DataflowScopeName, GlobalScope, LocalScope } from '../graph'
import { dataflowLogger } from '../index'

/**
 * Insert the given `definition` --- defined within the given scope --- into the passed along `environments` will take care of propagation.
 * Modifies the passed along `environments` in-place. It returns the same reference for ease of use.
 */
export function define(definition: IdentifierDefinition, withinScope: DataflowScopeName, environments: REnvironmentInformation): REnvironmentInformation {
  dataflowLogger.trace(`Defining ${definition.name} in ${withinScope} (${JSON.stringify(definition)})`)
  if(withinScope === LocalScope) {
    environments.current.memory.set(definition.name, [definition])
  } else if (withinScope === GlobalScope) {
    let current: IEnvironment | undefined = environments.current
    do {
      current.memory.set(definition.name, [definition])
      current = current.parent
    } while (current !== undefined)
  }
  return environments
}
