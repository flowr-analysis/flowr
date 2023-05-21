import { guard } from '../../util/assert'
import { REnvironmentInformation, IEnvironment, NamedEnvironments } from './environment'

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

export function overwriteEnvironments(base: REnvironmentInformation, next: REnvironmentInformation | undefined): REnvironmentInformation
export function overwriteEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation): REnvironmentInformation
export function overwriteEnvironments(base: undefined, next: undefined): undefined
export function overwriteEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined): REnvironmentInformation | undefined
/**
 * Assumes, that all definitions within next replace those within base (given the same name).
 */
export function overwriteEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined): REnvironmentInformation | undefined {
  if(base === undefined) {
    return next
  } else if(next === undefined) {
    return base
  }
  guard(next.local.length === base.local.length, `cannot overwrite environments with different local scopes, base ${base.local.length} vs. next ${next.local.length}. This should not happen.`)

  return {
    global: overwriteIEnvironmentWith(base.global, next.global),
    local:  next.local.map((env, index) => overwriteIEnvironmentWith(base.local[index], env)),
    named:  overwriteNamedEnvironments(base.named, next.named)
  }
}
