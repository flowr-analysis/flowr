/**
 * checks if `item` is an object (it may be an array, ...) but excludes `null`.
 */
export function isObjectOrArray (item: unknown): boolean {
  return typeof item === 'object' && item !== null
}

// TODO: maybe improve this in the future?
type MergeableRecord = Record<string, unknown>
type MergeableArray = unknown[]
type Mergeable = MergeableRecord | MergeableArray

/**
 * given two objects deeply merges them, if an object is an array it will merge the array values!
 */
export function deepMergeObject (base: Mergeable, addon: Mergeable): Mergeable {
  const result = Object.assign({}, base)

  if (!isObjectOrArray(base) || !isObjectOrArray(addon)) {
    return result
  }

  const baseIsArray = Array.isArray(base)
  const addonIsArray = Array.isArray(addon)

  if (baseIsArray && addonIsArray) {
    return [...base, ...addon]
  } else if (!baseIsArray && !addonIsArray) {
    deepMergeObjectWithResult(addon, base, result)
  } else {
    throw Error('Cannot merge array with object!')
  }
  return result
}

function deepMergeObjectWithResult (addon: MergeableRecord, base: MergeableRecord, result: Mergeable): void {
  Object.keys(addon).forEach(key => {
    if (isObjectOrArray(addon[key])) {
      if (!(key in base)) {
        Object.assign(result, { [key]: addon[key] })
      } else {
        (result as Record<string, any>)[key] = deepMergeObject(base[key] as Mergeable, addon[key] as Mergeable)
      }
    } else {
      Object.assign(result, { [key]: addon[key] })
    }
  })
}
