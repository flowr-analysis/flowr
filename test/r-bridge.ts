import { RShell } from '../src/r-bridge/shell'
import { assert } from 'chai'
import { valueToR } from '../src/r-bridge/lang'
import { it } from 'mocha'

describe('R-Bridge', () => {
  describe('r language utilities', () => {
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
  })

  describe('shell shell', () => {
    // TODO: maybe just use beforeEach and afterEach to provide? or better trest structure?
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
    withShell('1. let R make an addition', (shell, done) => {
      void shell.sendCommandWithOutput('1 + 1').then(lines => {
        assert.equal(lines.length, 1)
        assert.equal(lines[0], '[1] 2')
        done()
      })
    })
  })
})
