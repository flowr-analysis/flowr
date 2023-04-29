import { assert } from 'chai'
import { allPermutations, splitArrayOn } from '../../src/util/arrays'

describe('Arrays', () => {
  describe('splitArrayOn', () => {
    const test = <T>(title: string, arr: T[], predicate: (elem: T) => boolean, expected: T[][]): void => {
      it(title, () => {
        assert.deepStrictEqual(splitArrayOn(arr, predicate), expected, `${JSON.stringify(arr)} & ${JSON.stringify(predicate)}`)
      })
    }
    test('empty array', [], () => true, [])
    test('false predicate' , [1, 2, 3], () => false, [[1, 2, 3]])
    test('split on all', [1, 2, 3], () => true, [[], [], []])
    test('split on empty string', ['a', '', 'b', '', '', 'c'], elem => elem === '', [['a'], ['b'], [], ['c']])
  })
  describe('allPermutations', () => {
    const test = <T>(title: string, arr: T[], ...expected: T[][]): void => {
      it(`${title} (${JSON.stringify(arr)})`, () => {
        const permutations = [...allPermutations(arr)]
        assert.sameDeepMembers(permutations, expected, `${JSON.stringify(arr)}`)
      })
    }
    test('empty array', [], [])
    test('single element', [1], [1])
    // swapping the order should not change the permutations
    test('two elements', [1, 2], [1, 2], [2, 1])
    test('two elements', [2, 1], [1, 2], [2, 1])
    test('three elements', [1, 2, 3], [1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1])
    test('three elements', [1, 3, 2], [1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1])
    test('three elements', [3, 2, 1], [1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1])
    test('with strings', ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'c', 'b'], ['b', 'a', 'c'], ['b', 'c', 'a'], ['c', 'a', 'b'], ['c', 'b', 'a'])
  })
})
