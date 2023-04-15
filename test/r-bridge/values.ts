import { it } from 'mocha'
import { assert } from 'chai'
import { valueToR } from '../../src/r-bridge/lang/values'

describe('TS value to R', () => {
  it('undefined', () => {
    assert.equal(valueToR(undefined), 'NA')
  })
  it('null', () => {
    assert.equal(valueToR(null), 'NULL')
  })
  it('booleans', () => {
    assert.equal(valueToR(true), 'TRUE')
    assert.equal(valueToR(false), 'FALSE')
  })
  it('numbers', () => {
    assert.equal(valueToR(1), '1')
    assert.equal(valueToR(1.1), '1.1')
  })
  it('strings', () => {
    assert.equal(valueToR(''), '""', 'empty string')
    assert.equal(valueToR('abc'), '"abc"')
  })
  it('arrays', () => {
    assert.equal(valueToR([]), 'c()', 'empty array')
    assert.equal(valueToR([1, 2, 3]), 'c(1, 2, 3)')
  })
  it('objects', () => {
    assert.equal(valueToR({}), 'list()', 'empty object')
    assert.equal(valueToR({ a: 1, b: 2 }), 'list(a = 1, b = 2)')
    assert.equal(valueToR({ a: 1, b: { c: 2, d: 3 } }), 'list(a = 1, b = list(c = 2, d = 3))')
  })
  it('error for unknown conversions', () => {
    assert.throws(() => valueToR(() => 1), Error, undefined, 'function')
  })
})
