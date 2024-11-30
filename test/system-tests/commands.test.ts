import { assert, describe, test } from 'vitest';
import { run } from './utility/utility';


describe('commands', () => {
	test('flowr as server', async() => {
		const expected = 'Server listening on port';
		const output = await run('npm run flowr -- --server', expected, 60 * 1000);
		assert.include(output, expected);
	});

	test('slicer', async() => {
		const output = await run('npm run slicer -- -c "3@a" -r "a <- 3\\nb <- 4\\nprint(a)"');
		assert.include(output, 'a <- 3\na');
	});
});
