import { SourceRange } from '../../../src/util/range';
import { allPermutations } from '../../../src/util/collections/arrays';
import { describe, assert, test } from 'vitest';
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../_helper/shell';
import { isNotUndefined } from '../../../src/util/assert';
import type { RNodeWithParent } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

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
			test(`${code} (${treatChildAsInner ? 'child' : 'both'})`, async() => {
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

	describe('combineRanges', () => {
		const r = SourceRange.from;
		test('a range another one contains is dropped', () => {
			assert.deepStrictEqual(SourceRange.combineRanges(r(1, 1, 1, 9), r(1, 3, 1, 5)), [r(1, 1, 1, 9)]);
			assert.deepStrictEqual(SourceRange.combineRanges(r(1, 3, 1, 5), r(1, 1, 1, 9)), [r(1, 1, 1, 9)]);
		});
		test('duplicates collapse onto the first of them', () => {
			assert.deepStrictEqual(SourceRange.combineRanges(r(1, 1, 1, 5), r(1, 1, 1, 5)), [r(1, 1, 1, 5)]);
			assert.deepStrictEqual(SourceRange.combineRanges(r(1, 1, 1, 5), r(1, 1, 1, 5), r(1, 1, 1, 5)), [r(1, 1, 1, 5)]);
		});
		test('ranges that only overlap are both kept, as neither contains the other', () => {
			assert.deepStrictEqual(SourceRange.combineRanges(r(1, 1, 1, 5), r(1, 3, 1, 9)), [r(1, 1, 1, 5), r(1, 3, 1, 9)]);
		});
		test('a non-empty input never yields an empty result', () => {
			const sets = [[r(1, 1, 1, 5)], [r(1, 1, 1, 5), r(1, 1, 1, 5)], [r(1, 1, 1, 9), r(1, 3, 1, 5), r(1, 3, 1, 5)]];
			for(const set of sets) {
				assert.isNotEmpty(SourceRange.combineRanges(...set), JSON.stringify(set));
			}
		});
		test('nothing in, nothing out', () => {
			assert.deepStrictEqual(SourceRange.combineRanges(), []);
		});
	});

	describe('node sets', () => {
		/** the parts of a node these two look at: its range, its id, and who its parent is */
		const node = (id: NodeId, range: SourceRange | undefined, parent?: NodeId): RNodeWithParent =>
			({ info: { id, parent, ...(range ? { fullRange: range } : {}) } }) as unknown as RNodeWithParent;
		const ids = (nodes: readonly RNodeWithParent[]): NodeId[] => nodes.map(n => n.info.id);

		describe('nodesContaining', () => {
			const outer = node(1, SourceRange.from(1, 1, 3, 10));
			const inner = node(2, SourceRange.from(2, 5, 2, 9));
			const other = node(3, SourceRange.from(5, 1, 5, 4));
			const nowhere = node(4, undefined);
			const all = [outer, inner, other, nowhere];

			test('a line alone keeps every node spanning it', () => {
				assert.deepStrictEqual(ids(SourceRange.nodesContaining(all, 2)), [1, 2]);
				assert.deepStrictEqual(ids(SourceRange.nodesContaining(all, 5)), [3]);
				assert.deepStrictEqual(ids(SourceRange.nodesContaining(all, 4)), []);
			});
			test('a column narrows to the nodes really covering the position', () => {
				assert.deepStrictEqual(ids(SourceRange.nodesContaining(all, 2, 7)), [1, 2]);
				assert.deepStrictEqual(ids(SourceRange.nodesContaining(all, 2, 1)), [1]);
			});
			test('the bounds of a range are inclusive', () => {
				assert.deepStrictEqual(ids(SourceRange.nodesContaining([inner], 2, 5)), [2]);
				assert.deepStrictEqual(ids(SourceRange.nodesContaining([inner], 2, 9)), [2]);
				assert.deepStrictEqual(ids(SourceRange.nodesContaining([inner], 2, 10)), []);
			});
			test('a node without a range is never contained', () => {
				assert.deepStrictEqual(ids(SourceRange.nodesContaining([nowhere], 1)), []);
				assert.deepStrictEqual(ids(SourceRange.nodesContaining([nowhere], 1, 1)), []);
			});
		});

		describe('innermostNodes', () => {
			test('nothing to compare against', () => {
				assert.deepStrictEqual(SourceRange.innermostNodes([]), []);
				const only = node(1, SourceRange.from(1, 1, 1, 4));
				assert.deepStrictEqual(SourceRange.innermostNodes([only]), [only]);
			});
			test('a node without a range is kept: it encloses nothing and nothing encloses it', () => {
				assert.deepStrictEqual(ids(SourceRange.innermostNodes([node(1, undefined)])), [1]);
				assert.deepStrictEqual(ids(SourceRange.innermostNodes([node(1, SourceRange.from(1, 1, 1, 9)), node(2, undefined)])), [1, 2]);
			});
			test('a non-empty input never yields an empty result', () => {
				const range = SourceRange.from(1, 1, 1, 4);
				const sets: RNodeWithParent[][] = [
					[node(1, undefined)],
					[node(1, undefined), node(2, undefined)],
					[node(1, range), node(2, range, 1)],
					[node(1, range), node(2, SourceRange.from(1, 2, 1, 3), 1)],
					[node(1, range), node(2, range, 1), node(3, range, 2), node(4, undefined)],
					// malformed: the parent links cycle, so every node loses the same-range tie to the other
					[node(1, range, 2), node(2, range, 1)],
					[node(1, range, 3), node(2, range, 1), node(3, range, 2)]
				];
				for(const set of sets) {
					for(const treatChildAsInner of [true, false]) {
						assert.isNotEmpty(SourceRange.innermostNodes(set, treatChildAsInner), JSON.stringify(ids(set)));
					}
				}
			});
			test('a strictly enclosed node wins, whoever its parent is', () => {
				const outer = node(1, SourceRange.from(1, 1, 1, 9));
				const inner = node(2, SourceRange.from(1, 3, 1, 5), 99);
				assert.deepStrictEqual(ids(SourceRange.innermostNodes([outer, inner])), [2]);
				assert.deepStrictEqual(ids(SourceRange.innermostNodes([outer, inner], false)), [2]);
			});
			test('an equal range is a tie only `treatChildAsInner` breaks, and only for a direct child', () => {
				const range = SourceRange.from(1, 1, 1, 4);
				const parent = node(1, range);
				const child = node(2, range, 1);
				assert.deepStrictEqual(ids(SourceRange.innermostNodes([parent, child])), [2]);
				assert.deepStrictEqual(ids(SourceRange.innermostNodes([parent, child], false)), [1, 2]);
				// unrelated nodes sharing a range are both kept: neither encloses the other
				const unrelated = node(3, range, 99);
				assert.deepStrictEqual(ids(SourceRange.innermostNodes([parent, unrelated])), [1, 3]);
			});
			test('a chain of equal ranges collapses onto its deepest node', () => {
				const range = SourceRange.from(1, 1, 1, 4);
				const chain = [node(1, range), node(2, range, 1), node(3, range, 2)];
				assert.deepStrictEqual(ids(SourceRange.innermostNodes(chain)), [3]);
				// with the intermediate missing the tie is not transitive, so both ends survive
				assert.deepStrictEqual(ids(SourceRange.innermostNodes([chain[0], chain[2]])), [1, 3]);
			});
			test('disjoint nodes all count as innermost', () => {
				const nodes = [node(1, SourceRange.from(1, 1, 1, 4)), node(2, SourceRange.from(2, 1, 2, 4))];
				assert.deepStrictEqual(ids(SourceRange.innermostNodes(nodes)), [1, 2]);
			});
		});
	});
});
