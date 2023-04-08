import { RShell } from '../src/r-bridge/shell'
import { assert } from 'chai'
import { valueToR } from '../src/r-bridge/lang'

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
    const sessionIt = (msg: string, fn: (session: RShell, done: Mocha.Done) => void): void => {
      it(msg, done => {
        let session: RShell | null = null
        session = new RShell()
        try {
          fn(session, err => {
            session?.close()
            done(err)
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
