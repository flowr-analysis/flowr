import { assert, describe, test } from 'vitest';
import { run, runCaptureAll } from './utility/utility';


describe('commands', () => {
	test('flowr as server', async() => {
		const expected = 'Server listening on port';
		const output = await run('npx ts-node --transpile-only src/cli/flowr.ts --server', expected);
		assert.include(output, expected);
	});

	test('slicer', async() => {
		const output = await run('npm run slicer -- -c "3@a" -r "a <- 3\\nb <- 4\\nprint(a)"');
		assert.include(output, 'a <- 3\na');
	});

	test('flowr --execute output is not truncated when piped', async() => {
		const output = await run('npx ts-node --transpile-only src/cli/flowr.ts --execute ":parse 1+2"');
		assert.include(output, '"1"', `missing first literal in output:\n${output}`);
		assert.include(output, '"2"', `missing last literal - output was likely truncated:\n${output}`);
	});

	test('flowr forwards options to the sub-script regardless of order', async() => {
		const scriptHelp = 'Slice R code based on a given slicing criterion';
		const misForwarded = 'Missing required arguments';
		for(const command of ['slicer --help', '--help slicer']) {
			const output = await runCaptureAll(`npx ts-node --transpile-only src/cli/flowr.ts ${command}`);
			assert.include(output, scriptHelp, `\`flowr ${command}\` should show the slicer help, but got:\n${output}`);
			assert.notInclude(output, misForwarded, `\`flowr ${command}\` forwarded the wrong arguments to the slicer:\n${output}`);
		}
	});
});
