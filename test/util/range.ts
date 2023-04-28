import { assert } from 'chai'
import { mergeRanges, rangeFrom, SourceRange } from '../../src/util/range'

describe('Ranges', () => {
  describe('rangeFrom', () => {
    it('correct parameters', () => {
      const pool = [-1, 0, 1, 2, 3, 99]
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
    function assertMerged (a: SourceRange, b: SourceRange, expected: SourceRange) {
      assert.deepStrictEqual(mergeRanges(a, b), expected, `mergeRanges(${JSON.stringify(a)}, ${JSON.stringify(b)})`)
    }

    const assertIndependentOfOrder= (a: SourceRange, b: SourceRange, expected: SourceRange): void => {
      assertMerged(a, b, expected)
      assertMerged(b, a, expected)
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
      assertIndependentOfOrder(rangeFrom(1, 1, 1, 2), rangeFrom(1, 2, 1, 3), rangeFrom(1, 1, 1, 3))
      assertIndependentOfOrder(rangeFrom(1, 2, 1, 3), rangeFrom(1, 1, 1, 3), rangeFrom(1, 1, 1, 3))
      assertIndependentOfOrder(rangeFrom(2, 1, 2, 3), rangeFrom(1, 2, 2, 4), rangeFrom(1, 2, 2, 4))
    })
    it('non-overlapping ranges', () => {
      assertIndependentOfOrder(rangeFrom(1, 1, 1, 2), rangeFrom(1, 3, 1, 4), rangeFrom(1, 1, 1, 4))
    })
  })
})
