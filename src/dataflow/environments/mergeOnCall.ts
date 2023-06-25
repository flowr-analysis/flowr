/**
 * Merge the calling and definition environment
 *
 * @module
 */

import { IEnvironment, REnvironmentInformation } from './environment'
import { overwriteIEnvironmentWith } from './overwrite'

/**
 * Overwrites, but only for the common upper scopes, works with environments that differ in depth
 */
export function mergeEnvironments(base: REnvironmentInformation, next: REnvironmentInformation | undefined): REnvironmentInformation
export function mergeEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation): REnvironmentInformation
export function mergeEnvironments(base: undefined, next: undefined): undefined
export function mergeEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined): REnvironmentInformation | undefined
export function mergeEnvironments(base: REnvironmentInformation | undefined, next: REnvironmentInformation | undefined): REnvironmentInformation | undefined {
  if(base === undefined) {
    return next
  } else if(next === undefined) {
    return base
  }

  return {
    current: mergeIEnvironmentWith(base.current, next.current),
    level:   Math.max(base.level, next.level),
  }
}


function flattenEnvironmentHierarchy(env: IEnvironment): IEnvironment[] {
  const flattenedEnv: IEnvironment[] = []
  let current: IEnvironment | undefined = env
  do {
    flattenedEnv.push(current)
    current = current.parent
  } while (current !== undefined)
  return flattenedEnv
}

function mergeIEnvironmentWith(base: IEnvironment, next: IEnvironment): IEnvironment {
  // flatten both parent hierarchies:
  const flatBase = flattenEnvironmentHierarchy(base)
  const flatNext = flattenEnvironmentHierarchy(next)

  const result = []
  for(let i = 0; i < Math.min(flatBase.length, flatNext.length); i++) {
    // overwrite the element from the end and therefore add the result to the beginning
    result.unshift(overwriteIEnvironmentWith(flatBase[flatBase.length - i], flatNext[flatNext.length - i], false))
  }





  // overwriteIEnvironmentWith
}
