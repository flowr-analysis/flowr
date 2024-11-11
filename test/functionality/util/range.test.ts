import type {
	SourceRange
} from '../../../src/util/range';
import {
	addRanges,
	mergeRanges, rangeCompare,
	rangeFrom, rangesOverlap,
	rangeStartsCompletelyBefore
} from '../../../src/util/range';
import { allPermutations } from '../../../src/util/arrays';
import { formatRange } from '../../../src/util/mermaid/dfg';
import { describe, assert, test } from 'vitest';

describe('Range', () => {
	describe('rangeFrom', () => {
		test('correct arguments', () => {
			const pool = [-1, 0, 1, 2, 99];
			for(const startLine of pool) {
				for(const startColumn of pool) {
					for(const endLine of pool) {
						for(const endColumn of pool) {
							assert.deepStrictEqual(
								rangeFrom(startLine, startColumn, endLine, endColumn),
								[startLine, startColumn, endLine, endColumn],
								'with numbers'
							);
							assert.deepStrictEqual(
								rangeFrom(
									`${startLine}`,
									`${startColumn}`,
									`${endLine}`,
									`${endColumn}`
								),
								[startLine, startColumn, endLine, endColumn],
								'with strings'
							);
						}
					}
				}
			}
		});
	});
	describe('rangeCompare', () => {
		function assertCompare(name: string, left: SourceRange, right: SourceRange, expected: number) {
			test(name, () => {
				assert.strictEqual(
					rangeCompare(left, right),
					expected,
					`rangeCompare(${JSON.stringify(left)}, ${JSON.stringify(right)})`
				);
				assert.strictEqual(
					rangeCompare(right, left),
					-expected,
					`rangeCompare(${JSON.stringify(right)}, ${JSON.stringify(left)})`
				);
			});
		}

		assertCompare('identical ranges', rangeFrom(1, 1, 1, 1), rangeFrom(1, 1, 1, 1), 0);
		assertCompare('smaller start line', rangeFrom(1, 1, 1, 1), rangeFrom(2, 1, 2, 1), -1);
		assertCompare('smaller start character', rangeFrom(1, 1, 1, 1), rangeFrom(1, 2, 1, 2), -1);
	});
	describe('rangesOverlap', () => {
		function assertOverlap(name: string, left: SourceRange, right: SourceRange, expected: boolean) {
			test(name, () => {
				assert.strictEqual(
					rangesOverlap(left, right),
					expected,
					`rangesOverlap(${JSON.stringify(left)}, ${JSON.stringify(right)})`
				);
				assert.strictEqual(
					rangesOverlap(right, left), expected,
					`rangesOverlap(${JSON.stringify(right)}, ${JSON.stringify(left)})`
				);
			});
		}

		assertOverlap('identical ranges', rangeFrom(1, 1, 1, 1), rangeFrom(1, 1, 1, 1), true);
		assertOverlap('overlapping end character', rangeFrom(1, 2, 1, 2), rangeFrom(1, 1, 1, 2), true);
		assertOverlap('overlapping end line', rangeFrom(1, 1, 2, 1), rangeFrom(2, 1, 2, 2), true);
		assertOverlap('not overlapping', rangeFrom(1, 1, 2, 1), rangeFrom(2, 2, 3, 1), false);
	});
	describe('mergeRanges', () => {
		function assertMerged(expected: SourceRange, ...a: SourceRange[]) {
			assert.deepStrictEqual(
				mergeRanges(...a),
				expected,
				`mergeRanges(${JSON.stringify(a)})`
			);
		}

		function assertIndependentOfOrder(
			expected: SourceRange,
			...a: SourceRange[]
		): void {
			for(const permutation of allPermutations(a)) {
				assertMerged(expected, ...permutation);
			}
		}
		test('throw on no range', () => {
			assert.throws(() => mergeRanges(), Error, undefined, 'no range to merge');
		});
		test('identical ranges', () => {
			for(const range of [rangeFrom(1, 1, 1, 1), rangeFrom(1, 2, 3, 4)]) {
				assertIndependentOfOrder(range, range, range);
			}
		});
		test('overlapping ranges', () => {
			assertIndependentOfOrder(
				rangeFrom(1, 1, 1, 3),
				rangeFrom(1, 1, 1, 2),
				rangeFrom(1, 2, 1, 3)
			);
			assertIndependentOfOrder(
				rangeFrom(1, 1, 1, 3),
				rangeFrom(1, 2, 1, 3),
				rangeFrom(1, 1, 1, 3)
			);
			assertIndependentOfOrder(
				rangeFrom(1, 2, 2, 4),
				rangeFrom(2, 1, 2, 3),
				rangeFrom(1, 2, 2, 4)
			);
		});
		test('non-overlapping ranges', () => {
			assertIndependentOfOrder(
				rangeFrom(1, 1, 1, 4),
				rangeFrom(1, 1, 1, 2),
				rangeFrom(1, 3, 1, 4)
			);
			assertIndependentOfOrder(
				rangeFrom(1, 1, 4, 4),
				rangeFrom(1, 1, 1, 1),
				rangeFrom(4, 4, 4, 4)
			);
		});
		test('more than two ranges', () => {
			assertIndependentOfOrder(
				rangeFrom(1, 1, 3, 3),
				rangeFrom(1, 1, 1, 1),
				rangeFrom(2, 2, 2, 2),
				rangeFrom(3, 3, 3, 3)
			);
		});
	});
	describe('rangeStartsCompletelyBefore', () => {
		const assertStarts = (
			a: SourceRange,
			b: SourceRange,
			yesNo: boolean
		): void => {
			test(`${formatRange(a)} ${yesNo ? '<' : 'not <'} ${formatRange(b)}`, () => {
				assert.strictEqual(
					rangeStartsCompletelyBefore(a, b),
					yesNo,
					`rangeStartsCompletelyBefore(${JSON.stringify(a)}, ${JSON.stringify(
						b
					)})`
				);
			});
		};
		describe('identical ranges', () => {
			for(const sameRange of [rangeFrom(1, 1, 1, 1), rangeFrom(2, 1, 4, 7)]) {
				assertStarts(sameRange, sameRange, false);
			}
		});
		describe('smaller left', () => {
			assertStarts(rangeFrom(1, 1, 1, 1), rangeFrom(2, 1, 2, 1), true);
			assertStarts(rangeFrom(1, 1, 1, 1), rangeFrom(1, 1, 1, 2), false);
			assertStarts(rangeFrom(1, 1, 1, 1), rangeFrom(1, 2, 1, 1), true);
			assertStarts(rangeFrom(1, 1, 1, 1), rangeFrom(1, 1, 2, 1), false);
			assertStarts(rangeFrom(1, 1, 1, 1), rangeFrom(1, 1, 1, 2), false);
			assertStarts(rangeFrom(1, 1, 2, 1), rangeFrom(4, 2, 9, 3), true);
		});
		describe('smaller right', () => {
			assertStarts(rangeFrom(2, 1, 2, 1), rangeFrom(1, 1, 1, 1), false);
			assertStarts(rangeFrom(1, 1, 1, 2), rangeFrom(1, 1, 1, 1), false);
			assertStarts(rangeFrom(1, 2, 1, 1), rangeFrom(1, 1, 1, 1), false);
			assertStarts(rangeFrom(1, 1, 2, 1), rangeFrom(1, 1, 1, 1), false);
			assertStarts(rangeFrom(1, 1, 1, 2), rangeFrom(1, 1, 1, 1), false);
			assertStarts(rangeFrom(4, 2, 9, 3), rangeFrom(1, 1, 2, 1), false);
		});
	});
	describe('addRanges', () => {
		const assertAdd = (
			expected: SourceRange,
			a: SourceRange,
			b: SourceRange
		): void => {
			assert.deepStrictEqual(
				addRanges(a, b),
				expected,
				`addRanges(${JSON.stringify(a)}, ${JSON.stringify(b)})`
			);
		};

		const assertIndependentOfOrder = (
			expected: SourceRange,
			a: SourceRange,
			b: SourceRange
		): void => {
			assertAdd(expected, a, b);
			assertAdd(expected, b, a);
		};
		test('with zero', () => {
			assertIndependentOfOrder(
				rangeFrom(1, 1, 1, 1),
				rangeFrom(1, 1, 1, 1),
				rangeFrom(0, 0, 0, 0)
			);
			assertIndependentOfOrder(
				rangeFrom(4, 1, 9, 3),
				rangeFrom(4, 1, 9, 3),
				rangeFrom(0, 0, 0, 0)
			);
		});
		test('with other numbers', () => {
			assertIndependentOfOrder(
				rangeFrom(2, 3, 4, 5),
				rangeFrom(1, 1, 1, 1),
				rangeFrom(1, 2, 3, 4)
			);
			assertIndependentOfOrder(
				rangeFrom(6, 4, 9, 7),
				rangeFrom(2, 2, 3, 4),
				rangeFrom(4, 2, 6, 3)
			);
		});
	});
});
