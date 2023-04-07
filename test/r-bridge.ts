import { RShellSession } from '../src/r-bridge/rshell'
import { assert } from 'chai'
import { valueToR } from '../src/r-bridge/r-lang'

describe('R-Bridge', () => {
  describe('r language utilities', () => {
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
  })

  describe('shell session', () => {
    // TODO: maybe just use beforeEach and afterEach to provide?
    const sessionIt = (msg: string, fn: (session: RShellSession, done: Mocha.Done) => void): void => {
      it(msg, done => {
        const session = new RShellSession()
        fn(session, (err?: any) => { session.close(); done(err) })
      })
    }
    sessionIt('0. test that we can create a connection to R', (session, done) => {
      assert.doesNotThrow(() => {
        session.clearEnvironment()
        done()
      })
    })
    sessionIt('let R make an addition', (session, done) => {
      session.onData(data => {
        assert.equal(data, '[1] 2\n')
        done()
      })
      session.sendCommand('1 + 1')
    })
  })
})
