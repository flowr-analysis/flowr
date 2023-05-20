import { Environments, Identifier, IdentifierReference } from './environments'
import { DataflowScopeName, GlobalScope, LocalScope } from '../../graph'
import { dataflowLogger } from '../../index'
import { LogLevel } from '../../../util/log'

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
export function resolveName(name: Identifier, withinScope: DataflowScopeName, environments: Environments): IdentifierReference[] | undefined {
  if(withinScope === LocalScope) {
    return resolveLocal(name, withinScope, environments)
  } else if(withinScope === GlobalScope) {
    return resolveGlobal(name, withinScope, environments)
  } else {
    const namedScope = environments.named.get(withinScope)
    dataflowLogger.trace(`Resolving identifier ${name} in named scope ${withinScope} (${namedScope === undefined ? 'not found' : 'found'})`)
    return namedScope?.map.get(name)
  }
}

function resolveLocal(name: Identifier, withinScope: DataflowScopeName, environments: Environments) {
  dataflowLogger.trace(`Resolving local identifier ${name} (scope name: ${withinScope}, local stack size: ${environments.local.length})`)

  const locals = environments.local
  for (const element of locals) {
    const definition = element.map.get(name)
    if(definition !== undefined) {
      return definition
    }
  }
  dataflowLogger.trace(`Unable to find local identifier ${name} in local stack, falling back to global scope`)
  return environments.global.map.get(name)
}

function resolveGlobal(name: string, withinScope: string, environments: Environments) {
  dataflowLogger.trace(`Resolving global identifier ${name} (scope name: ${withinScope})`)
  return environments.global.map.get(name)
}
