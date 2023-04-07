import { assert } from 'chai'
import { deepMergeObject, isObjectOrArray } from '../src/util/objects'

describe('Objects', () => {
  describe('isObjectOrArray', () => {
    const positive = (a: any, msg: string): void => {
      assert.isTrue(isObjectOrArray(a), `must hold for ${msg}`)
    }
    const negative = (a: any, msg: string): void => {
      assert.isFalse(isObjectOrArray(a), `${msg} is not considered an object`)
    }

    it('return true for all kinds of objects', () => {
      positive({}, 'empty object')
      positive({ a: 'x', b: 0 }, 'non-empty object')
    })
    it('return true for all kinds of arrays', () => {
      positive([], 'empty array')
      positive([1, 2, 3], 'non-empty array')
    })

    it('return false for strings, numbers, and others ', () => {
      negative(true, 'a boolean')
      negative('hello', 'a string')
      negative(42, 'a number')
    })
  })

  describe('deepMergeObject', () => {
    const merged = (a: any, b: any, expected: any, msg?: string): void => {
      assert.deepEqual(deepMergeObject(a, b), expected, `${msg ?? ''} (${JSON.stringify(a)} & ${JSON.stringify(b)})`)
    }
    const throws = (a: any, b: any, msg?: string): void => {
      assert.throws(() => deepMergeObject(a, b), Error, undefined, msg)
    }
    describe('objects only', () => {
      describe('with empty', () => {
        for (const empty of [null, undefined, {}]) {
          const emptyStr = JSON.stringify(empty)
          describe(`using ${emptyStr}`, () => {
            it(`two ${emptyStr} objects`, () => {
              merged(empty, empty, empty)
            })
            for (const obj of [{ a: 1 }, { a: 1, b: 2 }, { a: 1, b: 2, c: { d: 3, e: 4 } }]) {
              it(JSON.stringify(obj), () => {
                merged(obj, empty, obj, 'left-hand')
                merged(empty, obj, obj, 'right-hand')
              })
            }
          })
        }
      })
      it('two non-empty (including overwrite)', () => {
        merged({ a: 3 }, { b: 4 }, { a: 3, b: 4 })
        merged({ a: 3, b: 4 }, { b: 5 }, { a: 3, b: 5 }, 'overwrite b')
        merged({ a: 3, b: { c: 4, d: 5 } }, { b: { c: 42 } }, { a: 3, b: { c: 42, d: 5 } }, 'overwrite nested c')
        merged({ a: 3, b: { c: 4, d: 5 } }, { b: { e: 6 } }, { a: 3, b: { c: 4, d: 5, e: 6 } }, 'nested e')
        merged({ a: 3, b: { c: 4, d: 5, e: {} } }, { b: { e: { f: 6 } } }, { a: 3, b: { c: 4, d: 5, e: { f: 6 } } }, 'double nested f')
      })
      it('allow null', () => {
        merged({ a: 3, b: null }, { b: { c: 42 } }, { a: 3, b: { c: 42 } })
        merged({ a: 3, b: { c: 4, d: 5 } }, { b: { e: 6 } }, { a: 3, b: { c: 4, d: 5, e: 6 } }, 'nested e')
      })
      it('error if incompatible', () => {
        throws({ a: 3 }, { a: { b: 3 } }, 'literal with object')
        throws({ a: { b: null } }, { a: { b: 3 } }, 'null obj with literal')
      })
    })
    describe('arrays only', () => {
      describe('with empty', () => {
        for (const empty of [null, undefined, []]) {
          const emptyStr = JSON.stringify(empty)
          describe(`using ${emptyStr}`, () => {
            it(`two ${emptyStr} arrays`, () => {
              merged(empty, empty, empty)
            })
            for (const obj of [[1], [1, 2], [1, 2, 3]]) {
              it(JSON.stringify(obj), () => {
                merged(obj, empty, obj, 'left-hand')
                merged(empty, obj, obj, 'right-hand')
              })
            }
          })
        }
      })
      it('two non-empty (no overwrite)', () => {
        merged([3], [4], [3, 4])
        merged([3, 4], [5], [3, 4, 5])
        merged([1, [3, 4]], [2, [5]], [1, [3, 4], 2, [5]], 'do not merge nested arrays')
        merged([{ a: 3 }, 2], [{ a: 4 }], [{ a: 3 }, 2, { a: 4 }], 'do not merge nested objects')
      })
    })
  })
})
