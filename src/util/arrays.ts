/**
 * Splits the array every time the given predicate fires.
 * The element the split appears on will not be included!
 *
 * @example with this we can split on all empty strings:
 * ```
 * splitArrayOn(['a', '', 'b', '', '', 'c'], elem => elem === '')
 * // => [['a'], ['b'], [], ['c']]
 * ```
 * @example if the last element satisfies the predicate, this will add an empty array element
 * ```
 * splitArrayOn([1,2,3], elem => true)
 * // => [[], [], [], []]
 * ```
 */
export function splitArrayOn<T>(arr: T[], predicate: (elem: T) => boolean): T[][] {
  const result: T[][] = []
  let current: T[] = []
  let fired = false
  for (const elem of arr) {
    if (predicate(elem)) {
      result.push(current)
      current = []
      fired = true
    } else {
      current.push(elem)
    }
  }

  if(fired || current.length > 0) {
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
  const c = new Array(arr.length).fill(0) as number[]
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
