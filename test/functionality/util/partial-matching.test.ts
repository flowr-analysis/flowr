import { assert, describe, test } from 'vitest';
import { findByPrefixIfUnique } from '../../../src/util/prefix';

describe('Partial Matching', () => {
	const testSets: {key: string, keys: string[], expected: string | undefined}[] = [
		{ key: '', keys: ['a', 'b'], expected: undefined }
	];
	for(const key of ['h', 'he', 'hel', 'hell', 'hello']) {
		for(const params of [['hello', 'world'], ['world', 'hello'], ['hello', 'jello']]) {
			testSets.push({ key, keys: params, expected: 'hello' });
		}
		for(const impossibleParams of [['rello', 'world'], ['world', 'hi', 'ho'], ['peter']]) {
			testSets.push({ key, keys: impossibleParams, expected: undefined });
		}
	}

	test.each(testSets)('With key %s', ({ key, keys, expected }) => {
		const res = findByPrefixIfUnique(key, keys);
		assert.strictEqual(res, expected, `searching for ${key} in ${JSON.stringify(keys)}`);
	});
});