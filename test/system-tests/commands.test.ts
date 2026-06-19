import { assert, describe, test } from 'vitest';
import { run } from './utility/utility';


describe('commands', () => {
	test('flowr as server', async() => {
		const expected = 'Server listening on port';
		const output = await run('npm run flowr -- --server', expected);
		assert.include(output, expected);
	});

	test('slicer', async() => {
		const output = await run('npm run slicer -- -c "3@a" -r "a <- 3\\nb <- 4\\nprint(a)"');
		assert.include(output, 'a <- 3\na');
	});

	test('flowr --execute output is not truncated when piped', async() => {
		const output = await run('npx ts-node --transpile-only src/cli/flowr.ts --execute ":parse 1+2"');
		assert.include(output, '"1"', `missing first literal in output:\n${output}`);
		assert.include(output, '"2"', `missing last literal — output was likely truncated:\n${output}`);
	});
});
