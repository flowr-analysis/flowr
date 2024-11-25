import { assert, describe, test } from 'vitest';
import { repl } from './utility/utility';

describe('repl', () => {
	test(':df', async() => {
		const output = await repl([':df test', ':quit']);
		console.log(output);
		assert.isTrue(output.includes('flowchart'));
	});

	
});