import { min2ms } from '../../src/util/time'
import { assert } from 'chai'

describe('time', () => {
  it('min2ms', () => {
    assert.equal(min2ms(0), 0)
    assert.equal(min2ms(1), 60_000)
    assert.equal(min2ms(42), 42 * 60_000)
  })
})
