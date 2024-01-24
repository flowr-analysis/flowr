import {guard} from '../../../src/util/assert'
import {assert} from 'chai'
import semver from 'semver/preload'
import {RShellExecutor} from '../../../src/r-bridge/shell-executor'

describe('RShell sessions', function() {
	const executor = new RShellExecutor()
	it('R version', () => {
		const version = executor.usedRVersion()
		guard(version !== null, 'we should be able to retrieve the version of R')
		assert.isNotNull(semver.valid(version), `the version ${JSON.stringify(version)} should be a valid semver`)
		assert.isTrue(semver.gt(version, '0.0.0'), `the version ${JSON.stringify(version)} should not be 0.0.0`)
	})
})