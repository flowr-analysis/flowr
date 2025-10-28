import { testWithShell, withShell } from '../_helper/shell';
import semver from 'semver/preload';
import { guard } from '../../../src/util/assert';
import { describe, assert, test, expect } from 'vitest';

/** here we use testWithShell to get a fresh shell within each call */
describe.sequential('RShell sessions', withShell(shell => {
	test('test that we can create a connection to R', () => {
		assert.doesNotThrow(() => {
			shell.clearEnvironment();
		});
	});
	describe('test the version of R', () => {
		test('query the installed version of R', async() => {
			const version = await shell.usedRVersion();
			guard(version !== null, 'we should be able to retrieve the version of R');
			assert.isNotNull(semver.valid(version), `the version ${JSON.stringify(version)} should be a valid semver`);
			assert.isTrue(semver.gt(version, '0.0.0'), `the version ${JSON.stringify(version)} should not be 0.0.0`);
		});
	});

	describe('let R make an addition', () => {
		[true, false].forEach(trimOutput => {
			test(`let R make an addition (${trimOutput ? 'with' : 'without'} trimming)`, async() => {
				const lines = await shell.sendCommandWithOutput('1 + 1', { automaticallyTrimOutput: trimOutput });
				assert.equal(lines.length, 1);
				assert.equal(lines[0], '[1] 2');
			});
		});
	});
	test('keep context of previous commands', async() => {
		shell.sendCommand('a <- 1 + 1');
		const lines = await shell.sendCommandWithOutput('a');
		assert.equal(lines.length, 1);
		assert.equal(lines[0], '[1] 2');
	});
	testWithShell('trigger timeout', async shell => {
		await expect(
			shell.sendCommandWithOutput('Sys.sleep(42)', {
				timeout: {
					ms:             1,
					resetOnNewData: false
				}
			})
		).rejects.toThrow();
	});
	test('send multiple commands', async() => {
		shell.sendCommands('a <- 1', 'b <- 2', 'c <- a + b');

		const lines = await shell.sendCommandWithOutput('c');
		assert.equal(lines.length, 1);
		assert.equal(lines[0], '[1] 3');
	});
}));
