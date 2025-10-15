import { guard } from '../../../src/util/assert';
import semver from 'semver/preload';
import { RShellExecutor } from '../../../src/r-bridge/shell-executor';
import { describe, assert, test } from 'vitest';

describe('RShellExecutor', function() {
	test('R version', () => {
		const version = new RShellExecutor().usedRVersion();
		guard(version !== null, 'we should be able to retrieve the version of R');
		assert.isNotNull(semver.valid(version), `the version ${JSON.stringify(version)} should be a valid semver`);
		assert.isTrue(semver.gt(version, '0.0.0'), `the version ${JSON.stringify(version)} should not be 0.0.0`);
	});

	test('ignore errors', () => {
		const executor = new RShellExecutor()
			.addPrerequisites('options(warn=-1); invisible(Sys.setlocale("LC_MESSAGES", \'en_GB.UTF-8\'))');

		// check the regular result when an error occurs
		const error = executor.run('a', true);
		assert.match(error, /Error.*'a'/g);
		assert.match(error, /halted/g);
	});
});
