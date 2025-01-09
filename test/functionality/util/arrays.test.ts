import { allPermutations, arrayEqual, getUniqueCombinationsOfSize, splitArrayOn, arraySum } from '../../../src/util/arrays';
import { describe, assert, test } from 'vitest';

describe('Arrays', () => {
	describe('sum', () => {
		const check = (title: string, arr: number[], expected: number): void => {
			test(title, () => {
				assert.strictEqual(arraySum(arr), expected, `${JSON.stringify(arr)}`);
			});
		};
		check('empty array', [], 0);
		check('single element', [1], 1);
		check('multiple elements', [1, 2, 3], 6);
	});
	describe('splitArrayOn', () => {
		const check = <T>(title: string, arr: T[], predicate: (elem: T) => boolean, expected: T[][]): void => {
			test(title, () => {
				assert.deepStrictEqual(splitArrayOn(arr, predicate), expected, `${JSON.stringify(arr)} & ${JSON.stringify(predicate)}`);
			});
		};
		check('empty array', [], () => true, []);
		check('false predicate' , [1, 2, 3], () => false, [[1, 2, 3]]);
		check('split on all', [1, 2, 3], () => true, [[], [], [], []]);
		check('split on empty string', ['a', '', 'b', '', '', 'c'], elem => elem === '', [['a'], ['b'], [], ['c']]);
	});
	describe('allPermutations', () => {
		const check = <T>(title: string, arr: T[], ...expected: T[][]): void => {
			test(`${title} (${JSON.stringify(arr)})`, () => {
				const permutations = [...allPermutations(arr)];
				assert.sameDeepMembers(permutations, expected, `${JSON.stringify(arr)}`);
			});
		};
		check('empty array', [], []);
		check('single element', [1], [1]);
		// swapping the order should not change the permutations
		check('two elements', [1, 2], [1, 2], [2, 1]);
		check('two elements', [2, 1], [1, 2], [2, 1]);
		check('three elements', [1, 2, 3], [1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]);
		check('three elements', [1, 3, 2], [1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]);
		check('three elements', [3, 2, 1], [1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]);
		check('with strings', ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'c', 'b'], ['b', 'a', 'c'], ['b', 'c', 'a'], ['c', 'a', 'b'], ['c', 'b', 'a']);
	});
	describe('getUniqueCombinationsOfSize', () => {
		const check = <T>(title: string, arr: T[], minSize: number, maxSize: number, ...expected: T[][]): void => {
			test(`${title} (${minSize}-${maxSize}, ${JSON.stringify(arr)})`, () => {
				const permutations = [...getUniqueCombinationsOfSize(arr, minSize, maxSize)];
				assert.sameDeepMembers(permutations, expected, `${JSON.stringify(arr)}`);
			});
		};
		check('empty array', [], 0, 0, []);
		check('single element', [1], 0, 1, [], [1]);
		check('single element', [1], 1, 1, [1]);
		check('single size', [1,2,3], 0, 1, [], [1], [2], [3]);
		check('single size', [1,2,3], 1, 1, [1], [2], [3]);
		check('higher sizes', [1,2,3], 1, 2, [1], [2], [3], [1,2], [1, 3], [2, 3]);
		check('higher sizes', [1,2,3], 2, 2, [1,2], [1, 3], [2, 3]);
		check('higher sizes', [1,2,3], 3, 3, [1,2,3]);
	});
	describe('arrayEqual', () => {
		const check = <T>(title: string, a: readonly T[] | undefined, b: readonly T[] | undefined, expected: boolean): void => {
			test(title, () => {
				assert.strictEqual(arrayEqual(a, b), expected, `${JSON.stringify(a)} & ${JSON.stringify(b)}`);
			});
		};
		check('empty arrays', [], [], true);
		check('undefined left', undefined, [], false);
		check('undefined right', [], undefined, false);
		check('empty right', [1], [], false);
		check('empty left',  [], [1], false);
		check('one element', [1], [1], true);
		check('one different element', [1], [2], false);
		check('two elements', [1, 2], [1, 2], true);
		check('different order', [1, 2], [2, 1], false);
	});
});
