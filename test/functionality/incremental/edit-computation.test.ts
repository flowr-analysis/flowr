import { describe, expect, it } from 'vitest';
import { computeEditRegion } from '../../../src/project/incremental/incremental-parse/edit-computation';

describe('computeEdit', () => {
	it('returns a no-op edit for identical content', () => {
		const result = computeEditRegion('abc', 'abc');

		expect(result.startIndex).toEqual(result.oldEndIndex);
		expect(result.startIndex).toEqual(result.newEndIndex);

		expect(result.startPosition).toEqual(result.oldEndPosition);
		expect(result.startPosition).toEqual(result.newEndPosition);
	});

	it('detects an insertion in the middle', () => {
		expect(computeEditRegion('abef', 'abcdef')).toEqual({
			startIndex:     2,
			oldEndIndex:    2,
			newEndIndex:    4,
			startPosition:  { row: 0, column: 2 },
			oldEndPosition: { row: 0, column: 2 },
			newEndPosition: { row: 0, column: 4 },
		});
	});

	it('detects a deletion in the middle', () => {
		expect(computeEditRegion('abcdef', 'abef')).toEqual({
			startIndex:     2,
			oldEndIndex:    4,
			newEndIndex:    2,
			startPosition:  { row: 0, column: 2 },
			oldEndPosition: { row: 0, column: 4 },
			newEndPosition: { row: 0, column: 2 },
		});
	});

	it('detects a replacement in the middle', () => {
		expect(computeEditRegion('abcdef', 'abXYef')).toEqual({
			startIndex:     2,
			oldEndIndex:    4,
			newEndIndex:    4,
			startPosition:  { row: 0, column: 2 },
			oldEndPosition: { row: 0, column: 4 },
			newEndPosition: { row: 0, column: 4 },
		});
	});

	it('detects an insertion at the beginning', () => {
		expect(computeEditRegion('world', 'hello world')).toEqual({
			startIndex:     0,
			oldEndIndex:    0,
			newEndIndex:    6,
			startPosition:  { row: 0, column: 0 },
			oldEndPosition: { row: 0, column: 0 },
			newEndPosition: { row: 0, column: 6 },
		});
	});

	it('detects a replacement of the whole content', () => {
		expect(computeEditRegion('abc', 'xyz')).toEqual({
			startIndex:     0,
			oldEndIndex:    3,
			newEndIndex:    3,
			startPosition:  { row: 0, column: 0 },
			oldEndPosition: { row: 0, column: 3 },
			newEndPosition: { row: 0, column: 3 },
		});
	});

	it('computes row/column positions correctly for multi-line edits', () => {
		expect(computeEditRegion('a\nbc\ndef', 'a\nXY\ndef')).toEqual({
			startIndex:     2,
			oldEndIndex:    4,
			newEndIndex:    4,
			startPosition:  { row: 1, column: 0 },
			oldEndPosition: { row: 1, column: 2 },
			newEndPosition: { row: 1, column: 2 },
		});
	});

	it('does not let suffix matching overlap with the prefix', () => {
		expect(computeEditRegion('aaa', 'aa')).toEqual({
			startIndex:     2,
			oldEndIndex:    3,
			newEndIndex:    2,
			startPosition:  { row: 0, column: 2 },
			oldEndPosition: { row: 0, column: 3 },
			newEndPosition: { row: 0, column: 2 },
		});
	});
});