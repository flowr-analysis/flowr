import { guard } from '../../../util/assert'
import { Environments, IEnvironment, NamedEnvironments } from './environments'

function appendIEnvironmentWith(base: IEnvironment, next: IEnvironment): IEnvironment {
  guard(base.name === next.name, 'cannot overwrite environments with different names')
  const map = new Map(base.map)
  for (const [key, value] of next.map) {
    const old = map.get(key)
    if(old) {
      // TODO: improve this to ensure there are no duplicates
      map.set(key, [...new Set([...old, ...value])])
    } else {
      map.set(key, value)
    }
  }
  return {
    name: base.name,
    map
  }
}

function appendNamedEnvironments(base: NamedEnvironments, next: NamedEnvironments): NamedEnvironments {
  const map = new Map(base)
  for (const [key, value] of next) {
    const old = map.get(key)
    if(old) {
      map.set(key, appendIEnvironmentWith(old, value))
    } else {
      map.set(key, value)
    }
  }
  return map
}

// TODO if we have something like x && (y <- 13) we still have to track the y assignment as maybe... or?
/**
 * Adds all writes of `next` to `base` (i.e., the operations of `next` *might* happen).
 */
export function appendEnvironments(base: Environments | undefined, next: Environments | undefined): Environments | undefined {
  if(base === undefined) {
    return next
  } else if(next === undefined) {
    return base
  }

  return {
    global: appendIEnvironmentWith(base.global, next.global),
    local:  next.local.map((env, index) => appendIEnvironmentWith(base.local[index], env)),
    named:  appendNamedEnvironments(base.named, next.named)
  }
}
