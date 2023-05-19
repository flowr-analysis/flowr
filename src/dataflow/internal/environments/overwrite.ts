import { guard } from '../../../util/assert'
import { Environments, IEnvironment, NamedEnvironments } from './environments'

function overwriteIEnvironmentWith(base: IEnvironment, next: IEnvironment): IEnvironment {
  guard(base.name === next.name, 'cannot overwrite environments with different names')
  const map = new Map(base.map)
  for (const [key, value] of next.map) {
    map.set(key, value)
  }
  return {
    name: base.name,
    map
  }
}

function overwriteNamedEnvironments(base: NamedEnvironments, next: NamedEnvironments): NamedEnvironments {
  const map = new Map(base)
  for (const [key, value] of next) {
    const old = map.get(key)
    if(old) {
      map.set(key, overwriteIEnvironmentWith(old, value))
    } else {
      map.set(key, value)
    }
  }
  return map
}

// TODO if we have something like x && (y <- 13) we still have to track the y assignment as maybe... or?
/**
 * Assumes, that all definitions within next replace those within base (given the same name).
 */
export function overwriteEnvironments(base: Environments, next: Environments): Environments {
  return {
    global: overwriteIEnvironmentWith(base.global, next.global),
    local:  next.local.map((env, index) => overwriteIEnvironmentWith(base.local[index], env)),
    named:  overwriteNamedEnvironments(base.named, next.named)
  }
}
