import { RShellSession } from '../src/r-bridge/rshell'
import { assert } from 'chai'
import { valueToR } from '../src/r-bridge/r-lang'
import { type Test } from 'mocha'

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
        let session: RShellSession | null = null
        session = new RShellSession()
        try {
          fn(session, err => {
            done(err)
            session?.close()
          })
        } catch (e) {
          // ensure we close the session in error cases too
          session?.close()
          throw e
        }
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
        // newline break is to be more robust against R versions
        assert.match(data, /\[1][\n ]2\n/)
        done()
      })
      session.sendCommand('1 + 1')
    })
  })
})
