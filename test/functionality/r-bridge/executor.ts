import {guard} from '../../../src/util/assert'
import {assert} from 'chai'
import semver from 'semver/preload'
import {RShellExecutor} from '../../../src/r-bridge/shell-executor'
import fs from 'fs'
import {testRequiresNetworkConnection} from '../_helper/network'
import {isInstallTest} from '../main.spec'
import {parseCSV} from '../../../src'

describe('RShellExecutor', function() {
	it('R version', () => {
		const version = new RShellExecutor().usedRVersion()
		guard(version !== null, 'we should be able to retrieve the version of R')
		assert.isNotNull(semver.valid(version), `the version ${JSON.stringify(version)} should be a valid semver`)
		assert.isTrue(semver.gt(version, '0.0.0'), `the version ${JSON.stringify(version)} should not be 0.0.0`)
	})

	it('ignore errors', () => {
		const executor = new RShellExecutor()
			.addPrerequisites('options(warn=-1); invisible(Sys.setlocale("LC_MESSAGES", \'en_GB.UTF-8\'))')

		// check regular result when an error occurs
		const error = executor.run('a', true)
		assert.match(error, /Error.*'a'/g)
		assert.match(error, /halted/g)

		// check continuing on error
		executor.continueOnError()
		const ignored = executor.run('a', true)
		assert.match(ignored, /Error.*'a'/g)
		assert.notMatch(ignored, /halted/g)
	})

	describe('install packages', function() {
		it('retrieve all', () => {
			const installed = new RShellExecutor().allInstalledPackages()
			assert.isTrue(installed.includes('base'), `base should be installed, but got: "${JSON.stringify(installed)}"`)
		})

		it('ensure installed', async() => {
			isInstallTest(this.ctx)
			await testRequiresNetworkConnection(this.ctx)

			const executor = new RShellExecutor()
			for(const pkg of ['xmlparsedata', 'glue']) {
				const result = executor.ensurePackageInstalled(pkg, false, true)
				assert.equal(result.packageName, pkg)

				// clean up the temporary directory
				if(result.libraryLocation !== undefined)
					fs.rmSync(result.libraryLocation, { recursive: true, force: true })
			}
		})

		it('ensure installed w/ autoload', () => {
			const executor = new RShellExecutor().tryToInjectHomeLibPath()
			executor.ensurePackageInstalled('xmlparsedata', true)
			// prove if we have it as a loaded namespace (fresh shell!)
			const got = parseCSV(executor.run('write.table(as.character(.packages()),sep=",", col.names=FALSE)').split('\n'))

			assert.isTrue(got.map(g => g[1]).includes('xmlparsedata'), `expected package xmlparsedata to be loaded, but got: ${JSON.stringify(got)}`)
		})
	})

	it('token map', () => {
		const executor = new RShellExecutor()
		assert.doesNotThrow(() => executor.getTokenMap())
	})
})
