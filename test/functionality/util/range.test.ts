import { SourceRange } from '../../../src/util/range';
import { allPermutations } from '../../../src/util/collections/arrays';
import { describe, assert, test } from 'vitest';
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../_helper/shell';
import { isNotUndefined } from '../../../src/util/assert';

describe('Range', () => {
	describe('SourceRange.from', () => {
		test('correct arguments', () => {
			const pool = [-1, 0, 1, 2, 99];
			for(const startLine of pool) {
				for(const startColumn of pool) {
					for(const endLine of pool) {
						for(const endColumn of pool) {
							assert.deepStrictEqual(
								SourceRange.from(startLine, startColumn, endLine, endColumn),
								[startLine, startColumn, endLine, endColumn],
								'with numbers'
							);
							assert.deepStrictEqual(
								SourceRange.from(
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
					SourceRange.compare(left, right),
					expected,
					`rangeCompare(${JSON.stringify(left)}, ${JSON.stringify(right)})`
				);
				assert.strictEqual(
					SourceRange.compare(right, left),
					-expected,
					`rangeCompare(${JSON.stringify(right)}, ${JSON.stringify(left)})`
				);
			});
		}

		assertCompare('identical ranges', SourceRange.from(1, 1, 1, 1), SourceRange.from(1, 1, 1, 1), 0);
		assertCompare('smaller start line', SourceRange.from(1, 1, 1, 1), SourceRange.from(2, 1, 2, 1), -1);
		assertCompare('smaller start character', SourceRange.from(1, 1, 1, 1), SourceRange.from(1, 2, 1, 2), -1);
	});
	describe('rangesOverlap', () => {
		function assertOverlap(name: string, left: SourceRange, right: SourceRange, expected: boolean) {
			test(name, () => {
				assert.strictEqual(
					SourceRange.overlap(left, right),
					expected,
					`rangesOverlap(${JSON.stringify(left)}, ${JSON.stringify(right)})`
				);
				assert.strictEqual(
					SourceRange.overlap(right, left), expected,
					`rangesOverlap(${JSON.stringify(right)}, ${JSON.stringify(left)})`
				);
			});
		}

		assertOverlap('identical ranges', SourceRange.from(1, 1, 1, 1), SourceRange.from(1, 1, 1, 1), true);
		assertOverlap('overlapping end character', SourceRange.from(1, 2, 1, 2), SourceRange.from(1, 1, 1, 2), true);
		assertOverlap('overlapping end line', SourceRange.from(1, 1, 2, 1), SourceRange.from(2, 1, 2, 2), true);
		assertOverlap('not overlapping', SourceRange.from(1, 1, 2, 1), SourceRange.from(2, 2, 3, 1), false);
	});
	describe('rangeIsSubsetOf', () => {
		function assertSubset(name: string, left: SourceRange, right: SourceRange, expected: boolean, expectedSwapped = !expected) {
			test(name, () => {
				assert.strictEqual(
					SourceRange.isSubsetOf(left, right),
					expected,
					`rangeIsSubsetOf(${JSON.stringify(left)}, ${JSON.stringify(right)})`
				);
				assert.strictEqual(
					SourceRange.isSubsetOf(right, left), expectedSwapped,
					`rangeIsSubsetOf(${JSON.stringify(right)}, ${JSON.stringify(left)})`
				);
			});
		}

		assertSubset('identical ranges', SourceRange.from(1, 1, 1, 1), SourceRange.from(1, 1, 1, 1), true, true);
		assertSubset('unrelated ranges', SourceRange.from(1, 2, 3, 4), SourceRange.from(5, 6, 7, 8), false, false);
		assertSubset('encompasses columns', SourceRange.from(1, 5, 1, 10), SourceRange.from(1, 1, 1, 20), true);
		assertSubset('encompasses lines', SourceRange.from(2, 1, 5, 2), SourceRange.from(1, 10, 20, 10), true);
	});
	describe('mergeRanges', () => {
		function assertMerged(expected: SourceRange, ...a: SourceRange[]) {
			assert.deepStrictEqual(
				SourceRange.merge(a),
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
			assert.throws(() => SourceRange.merge([]), Error, undefined, 'no range to merge');
		});
		test('identical ranges', () => {
			for(const range of [SourceRange.from(1, 1, 1, 1), SourceRange.from(1, 2, 3, 4)]) {
				assertIndependentOfOrder(range, range, range);
			}
		});
		test('overlapping ranges', () => {
			assertIndependentOfOrder(
				SourceRange.from(1, 1, 1, 3),
				SourceRange.from(1, 1, 1, 2),
				SourceRange.from(1, 2, 1, 3)
			);
			assertIndependentOfOrder(
				SourceRange.from(1, 1, 1, 3),
				SourceRange.from(1, 2, 1, 3),
				SourceRange.from(1, 1, 1, 3)
			);
			assertIndependentOfOrder(
				SourceRange.from(1, 2, 2, 4),
				SourceRange.from(2, 1, 2, 3),
				SourceRange.from(1, 2, 2, 4)
			);
		});
		test('non-overlapping ranges', () => {
			assertIndependentOfOrder(
				SourceRange.from(1, 1, 1, 4),
				SourceRange.from(1, 1, 1, 2),
				SourceRange.from(1, 3, 1, 4)
			);
			assertIndependentOfOrder(
				SourceRange.from(1, 1, 4, 4),
				SourceRange.from(1, 1, 1, 1),
				SourceRange.from(4, 4, 4, 4)
			);
		});
		test('more than two ranges', () => {
			assertIndependentOfOrder(
				SourceRange.from(1, 1, 3, 3),
				SourceRange.from(1, 1, 1, 1),
				SourceRange.from(2, 2, 2, 2),
				SourceRange.from(3, 3, 3, 3)
			);
		});
	});
	describe('rangeStartsCompletelyBefore', () => {
		const assertStarts = (
			a: SourceRange,
			b: SourceRange,
			yesNo: boolean
		): void => {
			test(`${SourceRange.format(a)} ${yesNo ? '<' : 'not <'} ${SourceRange.format(b)}`, () => {
				assert.strictEqual(
					SourceRange.startsCompletelyBefore(a, b),
					yesNo,
					`rangeStartsCompletelyBefore(${JSON.stringify(a)}, ${JSON.stringify(
						b
					)})`
				);
			});
		};
		describe('identical ranges', () => {
			for(const sameRange of [SourceRange.from(1, 1, 1, 1), SourceRange.from(2, 1, 4, 7)]) {
				assertStarts(sameRange, sameRange, false);
			}
		});
		describe('smaller left', () => {
			assertStarts(SourceRange.from(1, 1, 1, 1), SourceRange.from(2, 1, 2, 1), true);
			assertStarts(SourceRange.from(1, 1, 1, 1), SourceRange.from(1, 1, 1, 2), false);
			assertStarts(SourceRange.from(1, 1, 1, 1), SourceRange.from(1, 2, 1, 1), true);
			assertStarts(SourceRange.from(1, 1, 1, 1), SourceRange.from(1, 1, 2, 1), false);
			assertStarts(SourceRange.from(1, 1, 1, 1), SourceRange.from(1, 1, 1, 2), false);
			assertStarts(SourceRange.from(1, 1, 2, 1), SourceRange.from(4, 2, 9, 3), true);
		});
		describe('smaller right', () => {
			assertStarts(SourceRange.from(2, 1, 2, 1), SourceRange.from(1, 1, 1, 1), false);
			assertStarts(SourceRange.from(1, 1, 1, 2), SourceRange.from(1, 1, 1, 1), false);
			assertStarts(SourceRange.from(1, 2, 1, 1), SourceRange.from(1, 1, 1, 1), false);
			assertStarts(SourceRange.from(1, 1, 2, 1), SourceRange.from(1, 1, 1, 1), false);
			assertStarts(SourceRange.from(1, 1, 1, 2), SourceRange.from(1, 1, 1, 1), false);
			assertStarts(SourceRange.from(4, 2, 9, 3), SourceRange.from(1, 1, 2, 1), false);
		});
	});
	describe('addRanges', () => {
		const assertAdd = (
			expected: SourceRange,
			a: SourceRange,
			b: SourceRange
		): void => {
			assert.deepStrictEqual(
				SourceRange.add(a, b),
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
				SourceRange.from(1, 1, 1, 1),
				SourceRange.from(1, 1, 1, 1),
				SourceRange.from(0, 0, 0, 0)
			);
			assertIndependentOfOrder(
				SourceRange.from(4, 1, 9, 3),
				SourceRange.from(4, 1, 9, 3),
				SourceRange.from(0, 0, 0, 0)
			);
		});
		test('with other numbers', () => {
			assertIndependentOfOrder(
				SourceRange.from(2, 3, 4, 5),
				SourceRange.from(1, 1, 1, 1),
				SourceRange.from(1, 2, 3, 4)
			);
			assertIndependentOfOrder(
				SourceRange.from(6, 4, 9, 7),
				SourceRange.from(2, 2, 3, 4),
				SourceRange.from(4, 2, 6, 3)
			);
		});
	});

	describe('innermost', withTreeSitter(ts => {
		function check(code: string, provide: readonly SlicingCriterion[], expect: readonly SlicingCriterion[], treatChildAsInner = true) {
			test(code, async() => {
				const a = await new FlowrAnalyzerBuilder().setParser(ts).build();
				a.addRequest(code);
				const nast = await a.normalize();
				const [provNodes, expectNodes] = [provide, expect].map(e =>
					e.map(p => nast.idMap.get(SlicingCriterion.parse(p, nast.idMap)))
						.filter(isNotUndefined)
				);
				const received = SourceRange.innermostNodes(provNodes, treatChildAsInner).map(n => n.info.id).sort();
				const expected = expectNodes.map(n => n.info.id).sort();
				assert.deepStrictEqual(received, expected);
			});
		}

		check('f(x <- 2)', ['1@f', '1@<-'], ['1@<-']);
		check('f(x <- 2)', ['1@f', '1@<-'], ['1@<-'], false);
		check('f(x <- 2)', ['1@f', '1@<-', '1@x'], ['1@x']);
		check('f(x <- 2)', ['1@f', '1@<-', '1@x'], ['1@x'], false);
		check(`result <- data %>%
    filter(age > 30)`, ['1@<-', '1@%>%', '2@filter'], ['1@%>%', '2@filter']);
		check(`result <- data %>%
    filter(age > 30)`, ['1@<-', '1@%>%', '2@filter'], ['1@%>%', '2@filter'], false);
	}));
});
