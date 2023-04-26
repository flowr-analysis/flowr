import { assert } from 'chai'
import { deepMergeObject, isObjectOrArray } from '../../src/util/objects'
import { splitArrayOn } from '../../src/util/arrays'

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
})
