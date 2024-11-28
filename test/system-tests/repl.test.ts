import { assert, describe, test } from 'vitest';
import { flowrRepl } from './utility/utility';

describe('repl', () => {
	test(':df', async() => {
		const output = await flowrRepl([':df test', ':quit']);
		assert.include(output, 'flowchart');
	});

	test(':df x <- 3', async() => {
		const output = await flowrRepl([':df x <- 3 ', ':quit']);
		assert.include(output, 'flowchart');
	});

	test(':df "x <- 3\nprint(x)"', async() => {
		const output = await flowrRepl([':df "x <- 3\\nprint(x)"', ':quit']);
		assert.include(output, 'flowchart');
	});

	test(':slicer', async() => {
		const output = await flowrRepl([':slicer -c "3@a" -r "a <- 3\\nb <- 4\\nprint(a)"', ':quit']);
		assert.include(output, 'a <- 3\na');
	});
});
