import { assert, describe, test } from 'vitest';
import { getScriptArguments } from '../../../src/cli/flowr-main-options';

describe('flowr-main-options', () => {
	// https://github.com/flowr-analysis/flowr/issues/1638
	describe('getScriptArguments', () => {
		// process.argv starts with the node binary and the entry point, both of which are dropped
		const argv = (...args: string[]) => ['node', 'flowr.js', ...args];

		test.each([
			{ title: 'script name only',                script: 'slicer', args: ['slicer'],                                   expected: [] },
			{ title: 'option after the script name',    script: 'slicer', args: ['slicer', '--verbose'],                      expected: ['--verbose'] },
			{ title: 'option before the script name',   script: 'slicer', args: ['--verbose', 'slicer'],                      expected: ['--verbose'] },
			{ title: 'options surrounding the script',  script: 'slicer', args: ['--verbose', 'slicer', '--help'],            expected: ['--verbose', '--help'] },
			{ title: 'forwarded arguments keep order',  script: 'slicer', args: ['slicer', '-c', '12@product', 'file.R'],     expected: ['-c', '12@product', 'file.R'] },
			{ title: 'only the first occurrence drops', script: 'slicer', args: ['slicer', '-c', 'slicer'],                   expected: ['-c', 'slicer'] },
		])('$title', ({ script, args, expected }) => {
			assert.deepStrictEqual(getScriptArguments(script, argv(...args)), expected);
		});

		test('does not mutate the input argv', () => {
			const input = argv('--verbose', 'slicer', '--help');
			const copy = [...input];
			getScriptArguments('slicer', input);
			assert.deepStrictEqual(input, copy);
		});
	});
});
