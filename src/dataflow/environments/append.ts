import { guard } from '../../util/assert'
import { REnvironmentInformation, IEnvironment, NamedEnvironments, IdentifierDefinition } from './environment'

function uniqueMergeValues(old: IdentifierDefinition[], value: IdentifierDefinition[]): IdentifierDefinition[] {
  // TODO: improve this to ensure there are no duplicates
  const set = new Set(old)
  for (const v of value) {
    set.add(v)
  }
  return [...set]
}

function appendIEnvironmentWith(base: IEnvironment, next: IEnvironment): IEnvironment {
  guard(base.name === next.name, 'cannot overwrite environments with different names')
  const map = new Map(base.map)
  for (const [key, value] of next.map) {
    const old = map.get(key)
    if(old) {
      map.set(key, uniqueMergeValues(old, value))
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
export function appendEnvironments(base: REnvironmentInformation, next: REnvironmentInformation | undefined): REnvironmentInformation
export function appendEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation): REnvironmentInformation
export function appendEnvironments(base: undefined, next: undefined): undefined
export function appendEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined): REnvironmentInformation | undefined
export function appendEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined): REnvironmentInformation | undefined {
  if(base === undefined) {
    return next
  } else if(next === undefined) {
    return base
  }
  guard(base.local.length === next.local.length, "TODO; deal with the case if they differ")

  return {
    global: appendIEnvironmentWith(base.global, next.global),
    local:  next.local.map((env, index) => appendIEnvironmentWith(base.local[index], env)),
    named:  appendNamedEnvironments(base.named, next.named)
  }
}
