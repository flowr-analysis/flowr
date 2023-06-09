import { REnvironmentInformation, Identifier, IdentifierDefinition, IEnvironment } from './environment'
import { DataflowScopeName, GlobalScope, LocalScope } from '../graph'
import { dataflowLogger } from '../index'

// TODO: new log for resolution?

/**
 * Resolves a given identifier name to a list of its possible definition location using R scoping and resolving rules.
 *
 * @param name - The name of the identifier to resolve
 * @param withinScope - The scope in which the identifier is used (if it is a named scope, this will modify the resolution process)
 * @param environments - The current environments used for name resolution
 *
 * @returns A list of possible definitions of the identifier (one if the definition location is exactly and always known), or `undefined` if the identifier is undefined in the current scope/with the current environment information.
 */
export function resolveByName(name: Identifier, withinScope: DataflowScopeName, environments: REnvironmentInformation): IdentifierDefinition[] | undefined {
  if(withinScope === LocalScope) {
    return resolveLocal(name, withinScope, environments)
  } else if(withinScope === GlobalScope) {
    return resolveGlobal(name, withinScope, environments)
  }
  return undefined
}

function resolveLocal(name: Identifier, withinScope: DataflowScopeName, environments: REnvironmentInformation) {
  dataflowLogger.trace(`Resolving local identifier ${name} (scope name: ${withinScope}, local stack size: ${environments.local.length})`)

  const locals = environments.local
  let current: IEnvironment | undefined = locals[0]
  do {
    const definition = current.memory.get(name)
    if(definition !== undefined) {
      return definition
    }
    current = current.parent
  } while(current !== undefined)

  dataflowLogger.trace(`Unable to find identifier ${name} in local stack (present: [${locals.flatMap(e => [...e.memory.keys()]).join(",")}]), falling back to global scope`)
  return environments.global.memory.get(name)
}

function resolveGlobal(name: string, withinScope: string, environments: REnvironmentInformation) {
  dataflowLogger.trace(`Resolving global identifier ${name} (scope name: ${withinScope})`)
  return environments.global.memory.get(name)
}
