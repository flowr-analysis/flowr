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

  describe('shell shell', () => {
    // TODO: maybe just use beforeEach and afterEach to provide?
    const withShell = (msg: string, fn: (shell: RShell, done: Mocha.Done) => void): void => {
      it(msg, done => {
        let shell: RShell | null = null
        shell = new RShell()
        try {
          fn(shell, err => {
            shell?.close()
            done(err)
          })
        } catch (e) {
          // ensure we close the shell in error cases too
          shell?.close()
          throw e
        }
      })
    }
    withShell('0. test that we can create a connection to R', (shell, done) => {
      assert.doesNotThrow(() => {
        shell.clearEnvironment()
        done()
      })
    })
    withShell('1. let\'s R make an addition', (shell, done) => {
      shell.session.onLine('stdout', line => {
        // newline break is to be more robust against R versions
        assert.equal(line, '[1] 2')
        done()
      })
      shell.sendCommand('1 + 1')
    })
  })
})
