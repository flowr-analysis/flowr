import { guard } from './assert'

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
	for(const elem of arr) {
		if(predicate(elem)) {
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
 * @param arr - The array to permute
 * @see getUniqueCombinationsOfSize
 */
export function *allPermutations<T>(arr: T[]): Generator<T[], void, void>  {
	yield arr.slice()
	const c = new Array(arr.length).fill(0) as number[]
	let i = 1

	while(i < arr.length) {
		if(c[i] >= i) {
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
 * Generate all unique combinations of the array with the given size.
 * In other words, given `[a,b,c]`, as well as `minSize=2` and `maxSize=2`, this will generate `[a,b]`, `[a,c]` and `[b,c]`,
 * but not, e.g., `[a,a]` or `[b,a]`.
 *
 * @param array   - The array to generate combinations from
 * @param minSize - The inclusive minimum size of the combinations, must be at least `0` and at most `maxSize`
 * @param maxSize - The inclusive maximum size of the combinations, must be at least `minSize` and at most `array.length`
 */
export function *getUniqueCombinationsOfSize<T>(array: T[], minSize: number, maxSize: number): Generator<T[], void, void> {
	guard(minSize >= 0 && minSize <= maxSize, 'minSize must be at least 0 and at most maxSize')
	guard(maxSize >= minSize && maxSize <= array.length, 'maxSize must be at least minSize and at most the length of the array')
	if(minSize === maxSize && minSize === 1) {
		for(const elem of array) {
			yield [elem]
		}
		return
	}

	function *p(t: T[], i: number, newArr: boolean): Generator<T[], void, void> {
		// start yielding if min size is reached
		if(t.length >= minSize) {
			// only yield if the array has been modified
			if(newArr) {
				yield t
			}
			// stop yielding if inclusive max size is reached
			if(t.length >= maxSize) {
				return
			}
		}
		if(i >= array.length) {
			return
		}
		yield* p(t.concat(array[i]), i + 1, true)
		yield* p(t, i + 1, false)
	}

	yield* p([], 0, true)
}

/**
 * Returns the sum of all elements in the given array
 */
export function sum(arr: number[]): number {
	let sum = 0
	for(const elem of arr) {
		sum += elem
	}
	return sum
}

