import { assert, describe, test } from 'vitest';
import { repl } from './utility/utility';

describe('repl', () => {
	test(':df', async() => {
		const output = await repl([':df asd', ':quit']);
		assert.isTrue(output.includes('flowchart'));
	});
});