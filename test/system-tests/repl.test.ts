import { assert, describe, test } from 'vitest';
import { repl } from './utility/utility';

describe('repl', () => {
	test(':df', async() => {
		const output = await repl([':df test', ':quit']);
		assert.isTrue(output.includes('flowchart'));
	});

	test(':slicer', async() => {
		const output = await repl([':slicer -c "3@a" -r "a <- 3\\nb <- 4\\nprint(a)"', ':quit']);
		assert.isTrue(output.includes('a <- 3\na'));
	});
});