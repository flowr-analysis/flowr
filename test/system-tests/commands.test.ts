import { assert, describe, test } from 'vitest';
import { npmRun } from './utility/utility'

describe('commands', () => {
	test('flowr as server', async() => {
		const output = await npmRun('flowr', '--server');
        console.log("OUTPUT: " + output)
		assert.isTrue(output.includes('Server listening on port'));
	});
});