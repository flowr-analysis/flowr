import {guard} from '../../../src/util/assert'
import {assert} from 'chai'
import semver from 'semver/preload'
import {RShellExecutor} from '../../../src/r-bridge/shell-executor'
import fs from 'fs'
import {testRequiresNetworkConnection} from '../_helper/network'

describe('RShellExecutor', function() {
	const executor = new RShellExecutor()

	it('R version', () => {
		const version = executor.usedRVersion()
		guard(version !== null, 'we should be able to retrieve the version of R')
		assert.isNotNull(semver.valid(version), `the version ${JSON.stringify(version)} should be a valid semver`)
		assert.isTrue(semver.gt(version, '0.0.0'), `the version ${JSON.stringify(version)} should not be 0.0.0`)
	})

	describe('install packages', function() {
		it('retrieve all', () => {
			const installed = executor.allInstalledPackages()
			assert.isTrue(installed.includes('base'), `base should be installed, but got: "${JSON.stringify(installed)}"`)
		})

		it('check installed', () => {
			for(const nameOfInstalledPackage of executor.allInstalledPackages()) {
				const isInstalled = executor.isPackageInstalled(nameOfInstalledPackage)
				assert.isTrue(isInstalled, `package ${nameOfInstalledPackage} should be installed due to allInstalledPackages`)
			}
		}).timeout('1m') // this is much slower than the async one since we start a new shell every time

		it('ensure installed', async() => {
			await testRequiresNetworkConnection(this.ctx)
			for(const pkg of ['xmlparsedata', 'glue']) {
				const result = executor.ensurePackageInstalled(pkg, true)
				assert.equal(result.packageName, pkg)
				assert.isTrue(executor.isPackageInstalled(pkg))

				// clean up the temporary directory
				if(result.libraryLocation !== undefined)
					fs.rmSync(result.libraryLocation, { recursive: true, force: true })
			}
		})
	})
})