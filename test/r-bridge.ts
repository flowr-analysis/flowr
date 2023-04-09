import { RShell } from '../src/r-bridge/shell'
import { assert } from 'chai'
import { valueToR } from '../src/r-bridge/lang/values'
import { it } from 'mocha'
import * as fs from 'fs'
import { randomString } from '../src/util/random'
import { retrieveAstFromRCode } from '../src/r-bridge/parse'

// TODO: improve tests for shell so i can use await etc :C
describe('R-Bridge', () => {
  describe('R language utilities', () => {
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

  describe('RShell sessions', () => {
    // TODO: maybe just use beforeEach and afterEach to provide? or better test structure?
    const withShell = (msg: string, fn: (shell: RShell, done: Mocha.Done) => void): Mocha.Test => {
      return it(msg, done => {
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
    describe('1. let R make an addition', () => {
      [true, false].forEach((trimOutput, i) => {
        withShell(`${i + 1}. let R make an addition (${trimOutput ? 'with' : 'without'} trimming)`, (shell, done) => {
          void shell.sendCommandWithOutput('1 + 1', { automaticallyTrimOutput: trimOutput }).then(lines => {
            assert.equal(lines.length, 1)
            assert.equal(lines[0], '[1] 2')
            done()
          })
        })
      })
    })
    withShell('2. keep context of previous commands', (shell, done) => {
      shell.sendCommand('a <- 1 + 1')
      void shell.sendCommandWithOutput('a').then(lines => {
        assert.equal(lines.length, 1)
        assert.equal(lines[0], '[1] 2')
        done()
      })
    })
    withShell('3. clear environment should remove variable information', (shell, done) => {
      shell.continueOnError() // we will produce an error!
      shell.sendCommand('a <- 1 + 1')
      shell.clearEnvironment()
      void shell.sendCommandWithOutput('a', { from: 'stderr' }).then(lines => {
        assert.equal(lines.length, 1)
        // just await an error
        assert.match(lines[0], /^.*Error.*a/)
        done()
      })
    })
    describe('4. test if a package is already installed', () => {
      withShell('4.0 retrieve all installed packages', (shell, done) => {
        void shell.allInstalledPackages().then(got => {
          assert.isTrue(got.includes('base'), `base should be installed, but got: "${JSON.stringify(got)}"`)
          done()
        })
      })
      withShell('4.1 is installed', (shell, done) => {
        // of course someone could remove the packages in that instant, but for testing it should be fine
        void shell.allInstalledPackages().then(installed => {
          // we fold so that we have no listener leak when waiting o R
          void installed.reduce(async (t, nameOfInstalledPackage) => {
            await t.then(() => {
              void shell.isPackageInstalled(nameOfInstalledPackage).then(isInstalled => {
                assert.isTrue(isInstalled, `package ${nameOfInstalledPackage} should be installed due to allInstalledPackages`)
              })
            })
          }, Promise.resolve()).then(() => { done() })
        })
      })
      withShell('4.2 is not installed', (shell, done) => {
        // TODO URGENT: generate new unknown packages
        void shell.allInstalledPackages().then(installed => {
          let unknownPackageName: string
          do {
            unknownPackageName = randomString(10)
          }
          while (installed.includes(unknownPackageName))
          void shell.isPackageInstalled(unknownPackageName).then(isInstalled => {
            assert.isFalse(isInstalled, `package ${unknownPackageName} should not be installed`)
            done()
          })
        })
      })
    })
    describe('5. install a package', () => {
      withShell('5.0 try to install a package that is already installed', (shell, done) => {
        void shell.allInstalledPackages().then(([nameOfInstalledPackage]) => {
          void shell.ensurePackageInstalled(nameOfInstalledPackage, false).then(returnedPkg => {
            assert.equal(returnedPkg.packageName, nameOfInstalledPackage)
            assert.equal(returnedPkg.libraryLocation, undefined)
            done()
          })
        })
      })

      // multiple packages to avoid the chance of them being preinstalled
      // TODO: use withr to not install on host system and to allow this to work even without force?
      const i = 1
      for (const pkg of ['xmlparsedata', 'glue']) { // we use for instead of foreach to avoid index syntax issues
        withShell(`5.${i + 1} install ${pkg}`, (shell, done) => {
          void shell.ensurePackageInstalled(pkg, true).then(returnedPkg => {
            assert.equal(returnedPkg.packageName, pkg)
            // clean up the temporary directory
            if (returnedPkg.libraryLocation !== undefined) {
              fs.rmSync(returnedPkg.libraryLocation, { recursive: true, force: true })
            }
            done()
          })
        }).timeout('15min')
      }
    })
    withShell('7 send multiple commands', (shell, done) => {
      shell.sendCommands('a <- 1', 'b <- 2', 'c <- a + b')

      void shell.sendCommandWithOutput('c').then(lines => {
        assert.equal(lines.length, 1)
        assert.equal(lines[0], '[1] 3')
        done()
      })
    })
  })

  describe('Retrieve AST from R', () => {
    let shell: RShell
    before(async function () {
      this.timeout('10min')
      shell = new RShell()
      await shell.ensurePackageInstalled('xmlparsedata')
    })

    after(() => { shell.close() })
    beforeEach(() => { shell.clearEnvironment() })

    it('0. retrieve ast of literal', async () => {
      const ast = await retrieveAstFromRCode({ request: 'text', content: '1', attachSourceInformation: true }, shell)
      console.log(JSON.stringify(ast, null, 2))
    }).timeout('5min')
  })
})
