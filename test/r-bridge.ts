import { RShell } from '../src/r-bridge/shell'
import { assert } from 'chai'
import { valueToR } from '../src/r-bridge/lang/values'
import { it } from 'mocha'
import * as fs from 'fs'
import { randomString } from '../src/util/random'
import { getStoredTokenMap, retrieveAstFromRCode } from '../src/r-bridge/retriever'
import * as Lang from '../src/r-bridge/lang/ast/model'
import * as dns from 'dns/promises'

// based on https://stackoverflow.com/a/63756303
const hasNetworkConnection = async (): Promise<boolean> => await dns.resolve('google.com').catch(() => {}) !== null
/** Automatically skip a suite if no internet connection is available */
const suiteRequiresNetworkConnection = (): void => {
  before(async function() {
    if (!await hasNetworkConnection()) {
      console.warn('Skipping suite because no internet connection is available')
      this.skip()
    }
  })
}

/** Automatically skip a test if no internet connection is available */
const testRequiresNetworkConnection = async (test: Mocha.Context): Promise<void> => {
  if (!await hasNetworkConnection()) {
    console.warn('Skipping test because no internet connection is available')
    test.skip()
  }
}

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
    const withShell = (msg: string, fn: (shell: RShell, test: Mocha.Context) => void | Promise<void>): Mocha.Test => {
      return it(msg, async function (): Promise<void> {
        let shell: RShell | null = null
        shell = new RShell()
        try {
          await fn(shell, this)
        } finally {
          // ensure we close the shell in error cases too
          shell?.close()
        }
      })
    }
    withShell('0. test that we can create a connection to R', shell => {
      assert.doesNotThrow(() => {
        shell.clearEnvironment()
      })
    })
    describe('1. let R make an addition', () => {
      [true, false].forEach((trimOutput, i) => {
        withShell(`${i + 1}. let R make an addition (${trimOutput ? 'with' : 'without'} trimming)`, async shell => {
          const lines = await shell.sendCommandWithOutput('1 + 1', { automaticallyTrimOutput: trimOutput })
          assert.equal(lines.length, 1)
          assert.equal(lines[0], '[1] 2')
        })
      })
    })
    withShell('2. keep context of previous commands', async shell => {
      shell.sendCommand('a <- 1 + 1')
      const lines = await shell.sendCommandWithOutput('a')
      assert.equal(lines.length, 1)
      assert.equal(lines[0], '[1] 2')
    })
    withShell('3. clear environment should remove variable information', async shell => {
      shell.continueOnError() // we will produce an error!
      shell.sendCommand('a <- 1 + 1')
      shell.clearEnvironment()
      void shell.sendCommandWithOutput('a', { from: 'stderr' }).then(lines => {
        assert.equal(lines.length, 1)
        // just await an error
        assert.match(lines[0], /^.*Error.*a/)
      })
    })
    describe('4. test if a package is already installed', () => {
      withShell('4.0 retrieve all installed packages', async shell => {
        const installed = await shell.allInstalledPackages()
        assert.isTrue(installed.includes('base'), `base should be installed, but got: "${JSON.stringify(installed)}"`)
      })
      withShell('4.1 is installed', async shell => {
        // of course someone could remove the packages in that instant, but for testing it should be fine
        const installed = await shell.allInstalledPackages()

        for (const nameOfInstalledPackage of installed) {
          const isInstalled = await shell.isPackageInstalled(nameOfInstalledPackage)
          assert.isTrue(isInstalled, `package ${nameOfInstalledPackage} should be installed due to allInstalledPackages`)
        }
      })
      withShell('4.2 is not installed', async shell => {
        const installed = await shell.allInstalledPackages()
        let unknownPackageName: string
        do {
          unknownPackageName = randomString(10)
        }
        while (installed.includes(unknownPackageName))
        const isInstalled = await shell.isPackageInstalled(unknownPackageName)
        assert.isFalse(isInstalled, `package ${unknownPackageName} should not be installed`)
      })
    })
    describe('5. install a package', () => {
      withShell('5.0 try to install a package that is already installed', async shell => {
        const [nameOfInstalledPackage] = await shell.allInstalledPackages()
        const pkgLoadInfo = await shell.ensurePackageInstalled(nameOfInstalledPackage, false, false)
        assert.equal(pkgLoadInfo.packageName, nameOfInstalledPackage)
        assert.equal(pkgLoadInfo.libraryLocation, undefined)
      })

      // multiple packages to avoid the chance of them being preinstalled
      // TODO: use withr to not install on host system and to allow this to work even without force?
      const i = 1
      for (const pkg of ['xmlparsedata', 'glue']) { // we use for instead of foreach to avoid index syntax issues
        withShell(`5.${i + 1} install ${pkg}`, async function (shell, test) {
          await testRequiresNetworkConnection(test)
          const pkgLoadInfo = await shell.ensurePackageInstalled(pkg, false, true)
          assert.equal(pkgLoadInfo.packageName, pkg)
          // clean up the temporary directory
          if (pkgLoadInfo.libraryLocation !== undefined) {
            fs.rmSync(pkgLoadInfo.libraryLocation, { recursive: true, force: true })
          }
        }).timeout('15min')
      }
    })
    withShell('6. send multiple commands', async shell => {
      shell.sendCommands('a <- 1', 'b <- 2', 'c <- a + b')

      const lines = await shell.sendCommandWithOutput('c')
      assert.equal(lines.length, 1)
      assert.equal(lines[0], '[1] 3')
    })
  })

  // TODO: allow to specify where to install packages to so we can minimize installation to one temp directory
  describe('Retrieve AST from R', () => {
    const assertAst = (msg: string, input: string, expected: Lang.RExprList): Mocha.Test => {
      return it(msg, async () => {
        const shell = new RShell()
        // this way we probably do not have to reinstall even if we launch from WebStorm
        shell.tryToInjectHomeLibPath()
        if (!await shell.isPackageInstalled('xmlparsedata')) {
          // if we do not have it, we need to install!
          suiteRequiresNetworkConnection()
        }
        await shell.ensurePackageInstalled('xmlparsedata')
        const defaultTokenMap = await getStoredTokenMap(shell)

        after(() => { shell.close() })
        const ast = await retrieveAstFromRCode({ request: 'text', content: input, attachSourceInformation: true }, defaultTokenMap, shell)
        assert.deepStrictEqual(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`)
      }).timeout('15min') /* retrieval downtime */
    }
    const exprList = (...children: Lang.RExpr[]): Lang.RExprList => {
      return { type: Lang.Type.ExprList, children }
    }

    assertAst('0. retrieve ast of literal', '1', exprList({
      type: Lang.Type.Expr,
      content: '1',
      location: Lang.rangeFrom(1, 1, 1, 1),
      children: [{
        type: Lang.Type.Number,
        location: Lang.rangeFrom(1, 1, 1, 1),
        content: 1
      }]
    }))

    assertAst('1. retrieve ast of simple expression', '1 + 1', exprList({
      type: Lang.Type.Expr,
      content: '1 + 1',
      location: Lang.rangeFrom(1, 1, 1, 5),
      children: [
        {
          type: Lang.Type.BinaryOp,
          op: '+',
          location: Lang.rangeFrom(1, 3, 1, 3), // TODO fix this and merge with surrounding expr? everywhere?
          lhs: {
            type: Lang.Type.Expr,
            content: '1',
            location: Lang.rangeFrom(1, 1, 1, 1),
            children: [{
              type: Lang.Type.Number,
              location: Lang.rangeFrom(1, 1, 1, 1),
              content: 1
            }]
          },
          rhs: {
            type: Lang.Type.Expr,
            content: '1',
            location: Lang.rangeFrom(1, 5, 1, 5),
            children: [{
              type: Lang.Type.Number,
              location: Lang.rangeFrom(1, 5, 1, 5),
              content: 1
            }]
          }
        }
      ]
    }))
  })
})
