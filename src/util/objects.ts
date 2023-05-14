import { DeepPartial, DeepRequired } from 'ts-essentials'

/**
 * checks if `item` is an object (it may be an array, ...)
 */
export function isObjectOrArray(item: unknown): boolean {
  return typeof item === 'object'
}

// TODO: maybe improve this in the future?
export type MergeableRecord = Record<string, unknown>
export type MergeableArray = unknown[]
export type Mergeable = MergeableRecord | MergeableArray

/**
 * given two objects deeply merges them, if an object is an array it will merge the array values!
 * Guarantees some type safety by requiring objects to merge to be from the same type (allows undefined)
 *
 * TODO: set etc. support in the future? =\> merge type class like?
 */
export function deepMergeObject<T extends Mergeable>(base: Required<T>, addon?: T): Required<T>
export function deepMergeObject<T extends Mergeable>(base: DeepRequired<T>, addon?: T): DeepRequired<T>
export function deepMergeObject<T extends Mergeable>(base: T, addon?: DeepPartial<T> | Partial<T>): T
export function deepMergeObject(base: Mergeable, addon: Mergeable): Mergeable
export function deepMergeObject(base?: Mergeable, addon?: Mergeable): Mergeable | undefined
export function deepMergeObject(base?: Mergeable, addon?: Mergeable): Mergeable | undefined {
  assertSameType(base, addon)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (base === undefined || base === null) {
    return addon
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (addon === undefined || addon === null) {
    return base
  } else if (!isObjectOrArray(base) || !isObjectOrArray(addon)) {
    // this case should be guarded by type guards, but in case we do not know
    throw new Error('illegal types for deepMergeObject!')
  }

  const result = Object.assign({}, base) as MergeableRecord

  const baseIsArray = Array.isArray(base)
  const addonIsArray = Array.isArray(addon)

  if (!baseIsArray && !addonIsArray) {
    deepMergeObjectWithResult(addon, base, result)
  } else if (baseIsArray && addonIsArray) {
    return [...base, ...addon]
  } else {
    throw new Error('cannot merge object with array!')
  }

  return result
}

function deepMergeObjectWithResult(addon: MergeableRecord, base: MergeableRecord, result: MergeableRecord): void {
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

function assertSameType(base: unknown, addon: unknown): void {
  if (base !== undefined && addon !== undefined && typeof base !== typeof addon) {
    throw new Error(`cannot merge different types! ${typeof base} (${JSON.stringify(base)}) !== ${typeof addon} (${JSON.stringify(addon)})`)
  }
}
