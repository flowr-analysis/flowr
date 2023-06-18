import { guard } from '../../util/assert'
import { REnvironmentInformation, IEnvironment, Environment, IdentifierDefinition } from './environment'

function allAreMaybeGuardingSame(values: IdentifierDefinition[]): boolean {
  if(values.length === 0) {
    return true
  }
  const attr = values[0].used
  for (let i = 1; i < values.length; i++) {
    const used = values[i].used
    if(used !== attr) {
      throw new Error(`inconsistent used attributes within ${JSON.stringify(values)}`)
    }
  }
  return attr === 'maybe'
}

function overwriteIEnvironmentWith(base: IEnvironment | undefined, next: IEnvironment | undefined): IEnvironment {
  guard(base !== undefined && next !== undefined, 'can not overwrite environments with undefined')
  guard(base.name === next.name, 'cannot overwrite environments with different names')
  const map = new Map(base.memory)
  for (const [key, values] of next.memory) {
    const allMaybe = allAreMaybeGuardingSame(values)
    if(allMaybe) {
      const old = map.get(key) ?? []
      for(const o of old) {
        o.used = 'maybe'
      }

      map.set(key, old.concat(values))
    } else {
      map.set(key, values)
    }
  }
  const parent = base.parent === undefined ? undefined : overwriteIEnvironmentWith(base.parent, next.parent)

  const out = new Environment(base.name, parent)
  out.memory = map
  return out
}

// TODO if we have something like x && (y <- 13) we still have to track the y assignment as maybe... or?

export function overwriteEnvironments(base: REnvironmentInformation, next: REnvironmentInformation | undefined): REnvironmentInformation
export function overwriteEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation): REnvironmentInformation
export function overwriteEnvironments(base: undefined, next: undefined): undefined
export function overwriteEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined): REnvironmentInformation | undefined
/**
 * Assumes, that all definitions within next replace those within base (given the same name).
 * <b>But</b> if all definitions within next are maybe, then they are appended to the base definitions (updating them to be `maybe` from now on as well), similar to {@link appendEnvironments}.
 */
export function overwriteEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined): REnvironmentInformation | undefined {
  if(base === undefined) {
    return next
  } else if(next === undefined) {
    return base
  }
  guard(next.level === base.level, `cannot overwrite environments with differently nested local scopes, base ${base.level} vs. next ${next.level}. This should not happen.`)

  return {
    current: overwriteIEnvironmentWith(base.current, next.current),
    level:   base.level
  }
}
