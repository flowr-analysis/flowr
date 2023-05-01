import { assert } from 'chai'
import fs from 'fs'
import { randomString } from '../../src/util/random'
import { testRequiresNetworkConnection } from '../helper/network'
import { testWithShell, withShell } from '../helper/shell'
import { isInstallTest } from '../main.spec'
import { parseCSV } from '../../src/r-bridge/lang:4.x/values'
import { log, LogLevel } from '../../src/util/log'

/** here we use testWithShell to get a fresh shell within each call */
describe('RShell sessions', function() {
  this.slow('500ms') // some respect for the r shell :/
  testWithShell('0. test that we can create a connection to R', shell => {
    assert.doesNotThrow(() => {
      shell.clearEnvironment()
    })
  })
  describe('1. let R make an addition', () => {
    [true, false].forEach((trimOutput, i) => {
      testWithShell(`${i + 1}. let R make an addition (${trimOutput ? 'with' : 'without'} trimming)`, async shell => {
        const lines = await shell.sendCommandWithOutput('1 + 1', { automaticallyTrimOutput: trimOutput })
        assert.equal(lines.length, 1)
        assert.equal(lines[0], '[1] 2')
      })
    })
  })
  testWithShell('2. keep context of previous commands', async shell => {
    shell.sendCommand('a <- 1 + 1')
    const lines = await shell.sendCommandWithOutput('a')
    assert.equal(lines.length, 1)
    assert.equal(lines[0], '[1] 2')
  })
  testWithShell('3. clear environment should remove variable information', async shell => {
    shell.continueOnError() // we will produce an error!
    shell.sendCommand('a <- 1 + 1')
    shell.clearEnvironment()
    void shell.sendCommandWithOutput('a', { from: 'stderr' }).then(lines => {
      assert.equal(lines.length, 1)
      // just await an error
      assert.match(lines[0], /^.*Error.*a/)
    })
  })
  describe('4. test if a package is already installed', withShell(shell => {
    let installed: string[]
    before(async() => {
      installed = await shell.allInstalledPackages()
    })
    it('4.0 retrieve all installed packages', async() => {
      assert.isTrue(installed.includes('base'), `base should be installed, but got: "${JSON.stringify(installed)}"`)
    })
    it('4.1 is installed', async() => {
      // of course someone could remove the packages in that instant, but for testing it should be fine
      for (const nameOfInstalledPackage of installed) {
        const isInstalled = await shell.isPackageInstalled(nameOfInstalledPackage)
        assert.isTrue(isInstalled, `package ${nameOfInstalledPackage} should be installed due to allInstalledPackages`)
      }
    })
    it('4.2 is not installed', async() => {
      let unknownPackageName: string
      do {
        unknownPackageName = randomString(10)
      }
      while (installed.includes(unknownPackageName))

      const isInstalled = await shell.isPackageInstalled(unknownPackageName)
      assert.isFalse(isInstalled, `package ${unknownPackageName} should not be installed`)
    })
  }))
  describe('5. install a package', () => {
    testWithShell('5.0 try to install a package that is already installed', async shell => {
      const [nameOfInstalledPackage] = await shell.allInstalledPackages()
      const pkgLoadInfo = await shell.ensurePackageInstalled(nameOfInstalledPackage, false, false)
      assert.equal(pkgLoadInfo.packageName, nameOfInstalledPackage)
      assert.equal(pkgLoadInfo.libraryLocation, undefined)
    })

    // multiple packages to avoid the chance of them being preinstalled
    // TODO: use withr to not install on host system and to allow this to work even without force?
    installationTestSpec()
  })
  describe('6. autoload on package install', () => {
    log.updateSettings(l => { l.settings.minLevel = LogLevel.debug })
    testWithShell('6.0 package is loaded', async shell => {
      const pkg = 'xmlparsedata'
      shell.tryToInjectHomeLibPath()
      await shell.ensurePackageInstalled(pkg, true)
      // prove if we have it as a loaded namespace (fresh shell!)
      const got = parseCSV(await shell.sendCommandWithOutput('write.table(as.character(.packages()),sep=",", col.names=FALSE)'))

      assert.isTrue(got.map(g => g[1]).includes(pkg), `expected package ${pkg} to be loaded, but got: ${JSON.stringify(got)}`)
    })
    testWithShell('6.1 load with force install', async(shell, test) => {
      await testRequiresNetworkConnection(test)
      isInstallTest(test)

      const pkg = 'xmlparsedata'
      await shell.ensurePackageInstalled(pkg, true, true)
      // prove if we have it as a loaded namespace (fresh shell!)
      const got = parseCSV(await shell.sendCommandWithOutput('write.table(as.character(.packages()),sep=",", col.names=FALSE)'))

      assert.isTrue(got.map(g => g[1]).includes(pkg), `expected package ${pkg} to be loaded, but got: ${JSON.stringify(got)}`)
    }).timeout('15min')
  })
  testWithShell('7. send multiple commands', async shell => {
    shell.sendCommands('a <- 1', 'b <- 2', 'c <- a + b')

    const lines = await shell.sendCommandWithOutput('c')
    assert.equal(lines.length, 1)
    assert.equal(lines[0], '[1] 3')
  })
})

function installationTestSpec(): void {
  const i = 1
  for (const pkg of ['xmlparsedata', 'glue']) { // we use for instead of foreach to avoid index syntax issues
    testWithShell(`5.${i + 1} install ${pkg}`, async function(shell, test) {
      isInstallTest(test)
      await testRequiresNetworkConnection(test)
      const pkgLoadInfo = await shell.ensurePackageInstalled(pkg, false, true)
      assert.equal(pkgLoadInfo.packageName, pkg)
      // clean up the temporary directory
      if (pkgLoadInfo.libraryLocation !== undefined) {
        fs.rmSync(pkgLoadInfo.libraryLocation, { recursive: true, force: true })
      }
    }).timeout('15min')
  }
}
