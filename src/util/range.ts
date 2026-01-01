import { guard, isNotUndefined } from './assert';

/**
 * A source position in a file.
 *
 * Please note that some packages like `xmlparsedata` use their own start and end only to break ties
 * (e.g., `xmlparsedata` calculates them on a max col width approximation)
 */
export type SourcePosition = [
	/** starts with 1 */
	line:   number,
	/** starts with 1 */
	column: number
]

/**
 * Describe the start and end {@link SourcePosition|source position} of an element.
 * @see {@link rangeFrom} - to create a range
 * @see {@link mergeRanges} - to merge multiple ranges
 * @see {@link getRangeStart} - to get the start of a range
 * @see {@link getRangeEnd} - to get the end of a range
 * @see {@link rangeStartsCompletelyBefore} - to check if one range starts before another
 * @see {@link rangesOverlap} - to check if two ranges overlap
 * @see {@link addRanges} - to add two ranges
 * @see {@link rangeCompare} - to compare two ranges
 */
export type SourceRange = [
	/** inclusive start position */
	startLine:   number,
	startColumn: number,
	/** inclusive end position */
	endLine:     number,
	endColumn:   number
]

export function getRangeStart(p: undefined): undefined
export function getRangeStart(p: SourceRange): SourcePosition
export function getRangeStart(p: SourceRange | undefined): SourcePosition | undefined
/**
 * Returns the start position of a source range.
 */
export function getRangeStart(p: SourceRange | undefined): SourcePosition | undefined {
	return p === undefined ? undefined : [p[0], p[1]];
}

export function getRangeEnd(p: undefined): undefined
export function getRangeEnd(p: SourceRange): SourcePosition
export function getRangeEnd(p: SourceRange | undefined): SourcePosition | undefined
/**
 * Returns the end position of a source range.
 */
export function getRangeEnd(p: SourceRange | undefined): SourcePosition | undefined {
	return p === undefined ? undefined : [p[2], p[3]];
}

/**
 * This does not ensure ordering of start and end!
 * @param sl - start line
 * @param sc - start column
 * @param el - end line
 * @param ec - end column
 */
export function rangeFrom(sl: number | string, sc: number | string, el: number | string, ec: number | string): SourceRange {
	return [Number(sl), Number(sc), Number(el), Number(ec)];
}

/**
 * Merges multiple source ranges into a single source range that spans from the earliest start to the latest end.
 * If you are interested in combining overlapping ranges into a minimal set of ranges, see {@link combineRanges}.
 * @throws if no ranges are provided
 */
export function mergeRanges(...rs: (SourceRange | undefined)[]): SourceRange {
	const rsSafe: SourceRange[] = rs.filter(isNotUndefined);
	guard(rsSafe.length > 0, 'Cannot merge no ranges');
	return rsSafe.reduce(([sl, sc, el, ec], [nsl, nsc, nel, nec]) => [
		...(sl < nsl || (sl === nsl && sc < nsc) ? [sl, sc] : [nsl, nsc]),
		...(el > nel || (el === nel && ec > nec) ? [el, ec] : [nel, nec])
	] as SourceRange, rsSafe[0]);
}

/**
 * @returns true iff `r1` starts and ends before `r2` starts (i.e., if `r1` and `r2` do not overlap and `r1` comes before `r2`
 */
export function rangeStartsCompletelyBefore([,,r1el,r1ec]: SourceRange, [r2sl,r2sc,,]: SourceRange): boolean {
	return r1el < r2sl || (r1el === r2sl && r1ec < r2sc);
}

/**
 * Checks if the two ranges overlap.
 */
export function rangesOverlap([r1sl,r1sc,r1el,r1ec]: SourceRange, [r2sl,r2sc,r2el,r2ec]: SourceRange): boolean {
	return r1sl <= r2el && r2sl <= r1el && r1sc <= r2ec && r2sc <= r1ec;
}

/**
 * Calculate the component-wise sum of two ranges
 */
export function addRanges([r1sl,r1sc,r1el,r1ec]: SourceRange, [r2sl,r2sc,r2el,r2ec]: SourceRange): SourceRange {
	return [r1sl+r2sl, r1sc+r2sc, r1el+r2el, r1ec+r2ec];
}

/**
 * Provides a comparator for {@link SourceRange}s that sorts them in ascending order.
 * @returns a positive number if `r1` comes after `r2`, a negative number if `r1` comes before `r2`, and `0` if they are equal
 */
export function rangeCompare([r1sl,r1sc,,]: SourceRange, [r2sl,r2sc,,]: SourceRange): number {
	if(r1sl === r2sl) {
		return r1sc - r2sc;
	} else {
		return r1sl - r2sl;
	}
}

/**
 * Checks if the first range is a subset of the second range.
 */
export function rangeIsSubsetOf([r1sl,r1sc,r1el,r1ec]: SourceRange, [r2sl,r2sc,r2el,r2ec]: SourceRange): boolean {
	return (r1sl > r2sl || r1sl === r2sl && r1sc >= r2sc) && (r1el < r2el || r1sl === r2sl && r1ec <= r2ec);
}

/**
 * Combines overlapping or subset ranges into a minimal set of ranges.
 * If you are interested in merging overlapping ranges, see {@link mergeRanges}.
 */
export function combineRanges(...ranges: SourceRange[]): SourceRange[] {
	return ranges.filter(range => !ranges.some(other => range !== other && rangeIsSubsetOf(range, other)));
}

/** A source location consisting of a source range and an optional file name. */
export type SourceLocation = [...r: SourceRange, f?: string];