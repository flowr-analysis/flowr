import { assert, describe, test } from 'vitest';
import { run } from './utility/utility';

describe('Docker version extraction', () => {
	test('version output can be parsed with the Docker CI regex', async() => {
		const versionOutput = await run('npx ts-node --transpile-only src/cli/flowr.ts --version');
		// eslint-disable-next-line no-control-regex
		const cleanOutput = versionOutput.replace(/\x1b]8;;[^\x07]*\x07/g, '').replace(/\x1b\[[0-9;]*m/g, '');
		const extractedVersion = cleanOutput.match(/flowR\s*:\s*([^ ]+)/)?.[1];

		assert.isDefined(extractedVersion, `Version not found in output.\nCleaned output:\n${cleanOutput}`);
		assert.match(extractedVersion, /^\d+\.\d+\.\d+$/, `Extracted version should be semver format: ${extractedVersion}`);
	});

	test('version output shows engine information', async() => {
		const versionOutput = await run('npx ts-node --transpile-only src/cli/flowr.ts --version');

		assert.include(versionOutput, 'engine:', `version output should include engine information:\n${versionOutput}`);
		assert.include(versionOutput, 'R:', `version output should include R version information:\n${versionOutput}`);
	});
});
