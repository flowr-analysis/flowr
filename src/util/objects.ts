/**
 * checks if `item` is an object (it may be an array, ...)
 */
export function isObjectOrArray (item: unknown): boolean {
  return typeof item === 'object'
}

// TODO: maybe improve this in the future?
type MergeableRecord = Record<string, unknown>
type MergeableArray = unknown[]
type Mergeable = MergeableRecord | MergeableArray

/**
 * given two objects deeply merges them, if an object is an array it will merge the array values!
 * Guarantees some type safety by requiring objects to merge to be from the same type (allows undefined)
 *
 * TODO: set etc. support in the future? => merge type class like?
 */
export function deepMergeObject (base: Mergeable, addon: Mergeable): Mergeable {
  assertSameType(base, addon)
  if (base === undefined || base === null) {
    return addon
  } else if (addon === undefined || addon === null) {
    return base
  } else if (!isObjectOrArray(base) || !isObjectOrArray(addon)) { // overwrite
    return addon
  }

  const result = Object.assign({}, base) as MergeableRecord

  const baseIsArray = Array.isArray(base)
  const addonIsArray = Array.isArray(addon)

  if (!baseIsArray && !addonIsArray) {
    deepMergeObjectWithResult(addon, base, result)
  } else if (baseIsArray && addonIsArray) {
    return [...base, ...addon]
  } else {
    throw new Error('Cannot merge array with object!')
  }
  return result
}

function deepMergeObjectWithResult (addon: MergeableRecord, base: MergeableRecord, result: MergeableRecord): void {
  Object.keys(addon).forEach(key => {
    if (isObjectOrArray(addon[key])) {
      if (!(key in base)) {
        Object.assign(result, { [key]: addon[key] })
      } else {
        result[key] = deepMergeObject(base[key] as Mergeable, addon[key] as Mergeable)
      }
    } else {
      assertSameType(result[key], addon[key])
      Object.assign(result, { [key]: addon[key] })
    }
  })
}

function assertSameType (base: unknown, addon: unknown): void {
  if (base !== undefined && addon !== undefined && typeof base !== typeof addon) {
    throw new Error(`cannot merge different types! ${typeof base} (${JSON.stringify(base)}) !== ${typeof addon} (${JSON.stringify(addon)})`)
  }
}
