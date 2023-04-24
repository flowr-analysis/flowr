import { assert } from 'chai'
import { mergeRanges } from '../../../../src/r-bridge/lang:4.x/ast/model'
import * as Lang from '../../../../src/r-bridge/lang:4.x/ast/model'

describe('Model specific tests', () => {
  describe('mergeRanges', () => {
    it('deny to merge no ranges', () => {
      assert.throws(() => mergeRanges(), Error)
    })
    const assertMerged = (ranges: Lang.Range[], expected: Lang.Range, message = ''): void => {
      it(JSON.stringify(ranges), () => {
        assert.deepStrictEqual(mergeRanges(...ranges), expected, `${message}`)
      })
    }
    describe('one ranges always returns the same', () => {
      for (const range of [
        Lang.rangeFrom(0, 0, 0, 0),
        Lang.rangeFrom(1, 1, 1, 1),
        Lang.rangeFrom(1, 1, 5, 2),
        Lang.rangeFrom(9, 3, 42, 1)
      ]) {
        assertMerged([range], range, 'should be returned as is')
      }
    })
    describe('merge two consecutive ranges', () => {
      assertMerged([
        Lang.rangeFrom(1, 1, 1, 1),
        Lang.rangeFrom(1, 2, 1, 2)
      ], Lang.rangeFrom(1, 1, 1, 2))
      assertMerged([
        Lang.rangeFrom(1, 1, 1, 1),
        Lang.rangeFrom(1, 2, 1, 3)
      ], Lang.rangeFrom(1, 1, 1, 3))
      assertMerged([
        Lang.rangeFrom(1, 1, 1, 1),
        Lang.rangeFrom(1, 2, 1, 4)
      ], Lang.rangeFrom(1, 1, 1, 4))
    })
    describe('merge two non-consecutive ranges', () => {
      assertMerged([
        Lang.rangeFrom(1, 1, 1, 1),
        Lang.rangeFrom(1, 3, 1, 3)
      ], Lang.rangeFrom(1, 1, 1, 3))
      assertMerged([
        Lang.rangeFrom(3, 1, 3, 3),
        Lang.rangeFrom(4, 3, 6, 4)
      ], Lang.rangeFrom(3, 1, 6, 4))
    })
    describe('merge result is independent from order', () => {
      const a = Lang.rangeFrom(1, 2, 1, 2)
      const b = Lang.rangeFrom(4, 2, 5, 9)
      const c = Lang.rangeFrom(42, 3, 6, 6)
      // TODO: permutation function? :D | + improve these tests
      for (const perm of [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]) {
        assertMerged(perm, Lang.rangeFrom(1, 2, 6, 6))
      }
    })
  })
})
