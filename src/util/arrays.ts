/**
 * Splits the array every time the given predicate fires.
 * The element the split appears on will not be included!
 *
 * @example with this we can split on all empty strings:
 * ```
 * splitArrayOn(['a', '', 'b', '', '', 'c'], elem => elem === '')
 * // => [['a'], ['b'], [], ['c']]
 * ```
 */
export function splitArrayOn<T>(arr: T[], predicate: (elem: T) => boolean): T[][] {
  const result: T[][] = []
  let current: T[] = []
  for (const elem of arr) {
    if (predicate(elem)) {
      result.push(current)
      current = []
    } else {
      current.push(elem)
    }
  }

  if(current.length !== 0) {
    result.push(current)
  }
  return result
}
