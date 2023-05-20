import { IdentifierDefinition, REnvironmentInformation } from './environment'
import { DataflowScopeName, GlobalScope, LocalScope } from '../graph'
import { guard } from '../../util/assert'

/**
 * Insert the given `definition` --- defined within the given scope --- into the passed along `environments` will take care of propagation.
 */
export function define(definition: IdentifierDefinition, withinScope: DataflowScopeName, environments: REnvironmentInformation): REnvironmentInformation {
  if(withinScope === LocalScope) {
    environments.local[0].map.set(definition.name, [definition])
  } else if (withinScope === GlobalScope) {
    environments.global.map.set(definition.name, [definition])
    // TODO: really overwrite all locals on the way as well?
    environments.local.forEach(e => e.map.set(definition.name, [definition]))
  } else {
    const env = environments.named.get(withinScope)
    // TODO: i really want .map, .join etc directly on the iterators
    guard(env !== undefined, () => `named env ${withinScope} should exist but does not in ${[...environments.named.keys()].join(',')}`)
  }
  return environments
}
