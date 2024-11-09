import { setEquals } from '../../../src/util/set';
import { jsonReplacer } from '../../../src/util/json';
import { describe, assert, test } from 'vitest';

describe('Set (operations)', () => {
	describe('setEquals', () => {
		function check<T>(name: string, should: boolean, a: Set<T>, b: Set<T>) {
			return test(name, () =>
				assert.equal(setEquals(a, b), should, JSON.stringify(a, jsonReplacer) + ' ' + JSON.stringify(b, jsonReplacer)
				));
		}

		check('empty sets', true, new Set(), new Set());
		check('single element sets', true, new Set([1]), new Set([1]));
		check('multiple element sets', true, new Set([1, 2, 3]), new Set([1, 2, 3]));
		check('independent order', true, new Set([1, 2, 3]), new Set([3, 1, 2]));

		check('different size', false, new Set([1, 2, 3]), new Set([1, 2]));
		check('different elements', false, new Set([1, 2, 3]), new Set([1, 2, 4]));
	});
});
