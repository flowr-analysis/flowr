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

/**
 * Generate all permutations of the given array using Heap's algorithm (with its non-recursive variant).
 *
 * @param arr - the array to permute
 */
export function *allPermutations<T>(arr: T[]): Generator<T[], void, void>  {
  yield arr.slice()
  const c: number[] = new Array(arr.length).fill(0)
  let i = 1

  while (i < arr.length) {
    if (c[i] >= i) {
      c[i] = 0
      ++i
    } else {
      // save the swap to 0 (https://stackoverflow.com/questions/9960908/permutations-in-javascript/37580979#37580979)
      const k = i % 2 && c[i]
      const p = arr[i]
      arr[i] = arr[k]
      arr[k] = p
      ++c[i]
      i = 1
      yield arr.slice()
    }
  }
}


/**
 * Returns a map that uniquely maps each element of the given array to the number of times it appears in the array.
 */
// TODO: test
export function groupCount<T>(arr: T[]): Map<T, number> {
  const result = new Map<T, number>()
  for(const elem of arr) {
    const count = result.get(elem) ?? 0
    result.set(elem, count + 1)
  }
  return result
}
