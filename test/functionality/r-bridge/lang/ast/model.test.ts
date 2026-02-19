import { SourceRange } from '../../../../../src/util/range';
import { allPermutations } from '../../../../../src/util/collections/arrays';
import { describe, assert, test } from 'vitest';

describe('Model specific tests', () => {
	describe('mergeRanges', () => {
		test('deny to merge no ranges', () => {
			assert.throws(() => SourceRange.merge([]), Error);
		});
		const assertMerged = (ranges: SourceRange[], expected: SourceRange, message = ''): void => {
			test(JSON.stringify(ranges), () => {
				assert.deepStrictEqual(SourceRange.merge(ranges), expected, `${message}`);
			});
		};
		describe('one ranges always returns the same', () => {
			for(const range of [
				SourceRange.from(0, 0, 0, 0),
				SourceRange.from(1, 1, 1, 1),
				SourceRange.from(1, 1, 5, 2),
				SourceRange.from(9, 3, 42, 1)
			]) {
				assertMerged([range], range, 'should be returned as is');
			}
		});
		describe('merge two consecutive ranges', () => {
			assertMerged([
				SourceRange.from(1, 1, 1, 1),
				SourceRange.from(1, 2, 1, 2)
			], SourceRange.from(1, 1, 1, 2));
			assertMerged([
				SourceRange.from(1, 1, 1, 1),
				SourceRange.from(1, 2, 1, 3)
			], SourceRange.from(1, 1, 1, 3));
			assertMerged([
				SourceRange.from(1, 1, 1, 1),
				SourceRange.from(1, 2, 1, 4)
			], SourceRange.from(1, 1, 1, 4));
		});
		describe('merge two non-consecutive ranges', () => {
			assertMerged([
				SourceRange.from(1, 1, 1, 1),
				SourceRange.from(1, 3, 1, 3)
			], SourceRange.from(1, 1, 1, 3));
			assertMerged([
				SourceRange.from(3, 1, 3, 3),
				SourceRange.from(4, 3, 6, 4)
			], SourceRange.from(3, 1, 6, 4));
		});
		describe('merge result is independent from order', () => {
			const a = SourceRange.from(1, 2, 1, 2);
			const b = SourceRange.from(4, 2, 5, 9);
			const c = SourceRange.from(42, 3, 6, 6);
			for(const perm of allPermutations([a, b, c])) {
				assertMerged(perm, SourceRange.from(1, 2, 6, 6));
			}
		});
	});
});
