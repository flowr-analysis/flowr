import { RShellSession } from '../src/r-bridge/rshell'
import { assert } from 'chai'

describe('R-Bridge', () => {
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
