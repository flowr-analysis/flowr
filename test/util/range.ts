import { assert } from 'chai'
import { mergeRanges, rangeFrom, SourceRange } from '../../src/util/range'
import { allPermutations } from '../../src/util/arrays'

describe('Ranges', () => {
  describe('rangeFrom', () => {
    it('correct parameters', () => {
      const pool = [-1, 0, 1, 2, 99]
      for(const startLine of pool) {
        for(const startColumn of pool) {
          for (const endLine of pool) {
            for (const endColumn of pool) {
              assert.deepStrictEqual(rangeFrom(startLine, startColumn, endLine, endColumn),
                { start: { line: startLine, column: startColumn }, end: { line: endLine, column: endColumn } }, 'with numbers')
              assert.deepStrictEqual(rangeFrom(`${startLine}`, `${startColumn}`, `${endLine}`, `${endColumn}`),
                { start: { line: startLine, column: startColumn }, end: { line: endLine, column: endColumn } }, 'with strings')
            }
          }
        }
      }
    })
  })
  describe('mergeRanges', () => {
    function assertMerged (expected: SourceRange, ...a: SourceRange[]) {
      assert.deepStrictEqual(mergeRanges(...a), expected, `mergeRanges(${JSON.stringify(a)})`)
    }

    const assertIndependentOfOrder= (expected: SourceRange, ...a: SourceRange[]): void => {
      for(const permutation of allPermutations(a)) {
        assertMerged(expected, ...permutation)
      }
    }
    it('throw on no range', () => {
      assert.throws(() => mergeRanges(), Error, undefined, 'no range to merge')
    })
    it('identical ranges', () => {
      for(const range of [ rangeFrom(1, 1, 1, 1) , rangeFrom(1, 2, 3, 4) ]) {
        assertIndependentOfOrder(range, range, range)
      }
    })
    it('overlapping ranges', () => {
      assertIndependentOfOrder(rangeFrom(1, 1, 1, 3), rangeFrom(1, 1, 1, 2), rangeFrom(1, 2, 1, 3))
      assertIndependentOfOrder(rangeFrom(1, 1, 1, 3), rangeFrom(1, 2, 1, 3), rangeFrom(1, 1, 1, 3))
      assertIndependentOfOrder(rangeFrom(1, 2, 2, 4), rangeFrom(2, 1, 2, 3), rangeFrom(1, 2, 2, 4))
    })
    it('non-overlapping ranges', () => {
      assertIndependentOfOrder(rangeFrom(1, 1, 1, 4), rangeFrom(1, 1, 1, 2), rangeFrom(1, 3, 1, 4))
      assertIndependentOfOrder(rangeFrom(1, 1, 4, 4), rangeFrom(1, 1, 1, 1), rangeFrom(4, 4, 4, 4))
    })
    it('more than two ranges', () => {
      assertIndependentOfOrder(rangeFrom(1, 1, 3, 3), rangeFrom(1, 1, 1, 1), rangeFrom(2, 2, 2, 2), rangeFrom(3, 3, 3, 3))
    })
  })
})
