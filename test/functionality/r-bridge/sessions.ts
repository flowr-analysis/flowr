import chai, { assert } from 'chai'
import fs from 'fs'
import { randomString } from '../../../src/util/random'
import { testRequiresNetworkConnection } from '../_helper/network'
import { testWithShell, withShell } from '../_helper/shell'
import { isInstallTest } from '../main.spec'
import { parseCSV } from '../../../src/r-bridge'
import { log, LogLevel } from '../../../src/util/log'
import chaiAsPromised from 'chai-as-promised'
import semver from 'semver/preload'
import { guard } from '../../../src/util/assert'
chai.use(chaiAsPromised)

/** here we use testWithShell to get a fresh shell within each call */
describe('RShell sessions', function() {
	this.slow('500ms') // some respect for the r shell :/
	testWithShell('test that we can create a connection to R', shell => {
		assert.doesNotThrow(() => {
			shell.clearEnvironment()
		})
	})
	describe('test the version of R', () => {
		testWithShell('query the installed version of R', async shell => {
			const version = await shell.usedRVersion()
			guard(version !== null, 'we should be able to retrieve the version of R')
			assert.isNotNull(semver.valid(version), `the version ${JSON.stringify(version)} should be a valid semver`)
			assert.isTrue(semver.gt(version, '0.0.0'), `the version ${JSON.stringify(version)} should not be 0.0.0`)
		})
	})

	describe('let R make an addition', () => {
		[true, false].forEach(trimOutput => {
			testWithShell(`let R make an addition (${trimOutput ? 'with' : 'without'} trimming)`, async shell => {
				const lines = await shell.sendCommandWithOutput('1 + 1', { automaticallyTrimOutput: trimOutput })
				assert.equal(lines.length, 1)
				assert.equal(lines[0], '[1] 2')
			})
		})
	})
	testWithShell('keep context of previous commands', async shell => {
		shell.sendCommand('a <- 1 + 1')
		const lines = await shell.sendCommandWithOutput('a')
		assert.equal(lines.length, 1)
		assert.equal(lines[0], '[1] 2')
	})
	testWithShell('trigger timeout', async shell => {
		await assert.isRejected(
			shell.sendCommandWithOutput('Sys.sleep(42)', {
				timeout: {
					ms:             1,
					resetOnNewData: false
				}
			})
		)
	})
	testWithShell('clear environment should remove variable information', async shell => {
		shell.continueOnError() // we will produce an error!
		shell.sendCommand('invisible(Sys.setlocale("LC_MESSAGES", \'en_GB.UTF-8\'))')
		shell.sendCommand('a <- 1 + 1')
		shell.clearEnvironment()
		await shell.sendCommandWithOutput('a', { from: 'stderr' }).then(lines => {
			// just await an error
			assert.match(lines.join('\n'), /^.*Error.*a/)
		})
	})
	describe('test if a package is already installed', withShell(shell => {
		let installed: string[]
		before(async() => {
			installed = await shell.allInstalledPackages()
		})
		it('retrieve all installed packages', () => {
			assert.isTrue(installed.includes('base'), `base should be installed, but got: "${JSON.stringify(installed)}"`)
		})
		it('is installed', async() => {
			// of course someone could remove the packages in that instant, but for testing it should be fine
			for(const nameOfInstalledPackage of installed.slice(0,2)) {
				const isInstalled = await shell.isPackageInstalled(nameOfInstalledPackage)
				assert.isTrue(isInstalled, `package ${nameOfInstalledPackage} should be installed due to allInstalledPackages`)
			}
		})
		it('is not installed', async() => {
			let unknownPackageName: string
			do{
				unknownPackageName = randomString(10)
			}
			while(installed.includes(unknownPackageName))

			const isInstalled = await shell.isPackageInstalled(unknownPackageName)
			assert.isFalse(isInstalled, `package ${unknownPackageName} should not be installed`)
		})
	}))
	describe('install a package', () => {
		testWithShell('try to install a package that is already installed', async shell => {
			const [nameOfInstalledPackage] = await shell.allInstalledPackages()
			const pkgLoadInfo = await shell.ensurePackageInstalled(nameOfInstalledPackage, false, false)
			assert.equal(pkgLoadInfo.packageName, nameOfInstalledPackage)
			assert.equal(pkgLoadInfo.libraryLocation, undefined)
		})

		// multiple packages to avoid the chance of them being preinstalled
		installationTestSpec()
	})
	describe('autoload on package install', () => {
		log.updateSettings(l => { l.settings.minLevel = LogLevel.Debug })
		testWithShell('package is loaded', async shell => {
			const pkg = 'xmlparsedata'
			shell.tryToInjectHomeLibPath()
			await shell.ensurePackageInstalled(pkg, true)
			// prove if we have it as a loaded namespace (fresh shell!)
			const got = parseCSV(await shell.sendCommandWithOutput('write.table(as.character(.packages()),sep=",", col.names=FALSE)'))

			assert.isTrue(got.map(g => g[1]).includes(pkg), `expected package ${pkg} to be loaded, but got: ${JSON.stringify(got)}`)
		})
		testWithShell('load with force install', async(shell, test) => {
			await testRequiresNetworkConnection(test)
			isInstallTest(test)

			const pkg = 'xmlparsedata'
			await shell.ensurePackageInstalled(pkg, true, true)
			// prove if we have it as a loaded namespace (fresh shell!)
			const got = parseCSV(await shell.sendCommandWithOutput('write.table(as.character(.packages()),sep=",", col.names=FALSE)'))

			assert.isTrue(got.map(g => g[1]).includes(pkg), `expected package ${pkg} to be loaded, but got: ${JSON.stringify(got)}`)
		}).timeout('15min')
	})
	testWithShell('send multiple commands', async shell => {
		shell.sendCommands('a <- 1', 'b <- 2', 'c <- a + b')

		const lines = await shell.sendCommandWithOutput('c')
		assert.equal(lines.length, 1)
		assert.equal(lines[0], '[1] 3')
	})
})

function installationTestSpec(): void {
	for(const pkg of ['xmlparsedata', 'glue']) { // we use for instead of foreach to avoid index syntax issues
		testWithShell(`install ${pkg}`, async function(shell, test) {
			isInstallTest(test)
			await testRequiresNetworkConnection(test)
			const pkgLoadInfo = await shell.ensurePackageInstalled(pkg, false, true)
			assert.equal(pkgLoadInfo.packageName, pkg)
			// clean up the temporary directory
			if(pkgLoadInfo.libraryLocation !== undefined) {
				fs.rmSync(pkgLoadInfo.libraryLocation, { recursive: true, force: true })
			}
		}).timeout('15min')
	}
}
