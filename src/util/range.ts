import { guard, isNotUndefined } from './assert';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';

/**
 * A source position in a file.
 *
 * Please note that some packages like `xmlparsedata` use their own start and end only to break ties
 * (e.g., `xmlparsedata` calculates them on a max col width approximation)
 * @see {@link SourceRange|source ranges} for describing ranges of source positions.
 */
export type SourcePosition = [
	/** starts with 1 */
	line:   number,
	/** starts with 1 */
	column: number
];

/**
 * Utility functions for {@link SourcePosition|source positions}.
 */
export const SourcePosition = {
	/**
	 * Formats a {@link SourcePosition|source position} as a human-readable string.
	 */
	format(this: void, pos: SourcePosition | undefined): string {
		if(pos === undefined) {
			return '??.??';
		} else {
			return `${pos[0]}.${pos[1]}`;
		}
	},
	/**
	 * Creates a source position from the given line and column numbers.
	 * @param line - line number (starts with 1)
	 * @param column - column number (starts with 1)
	 */
	from(this: void, line: number | string, column: number | string): SourcePosition {
		return [Number(line), Number(column)];
	},
	/**
	 * returns an invalid source position
	 */
	invalid(this: void): SourcePosition {
		return [-1, -1];
	}
} as const;

/**
 * **Please note** that for multi-file projects we also have a {@link SourceLocation|source location} type that includes the file name.
 * Describe the start and end {@link SourcePosition|source position} of an element.
 * @see {@link SourceRange.format} and related utility functions for working with source ranges.
 */
export type SourceRange = [
	/** inclusive start position */
	startLine:   number,
	startColumn: number,
	/** inclusive end position */
	endLine:     number,
	endColumn:   number
];

/**
 * Utility functions for {@link SourceRange|source ranges}.
 */
export const SourceRange = {
	/**
	 * Prints a {@link SourceRange|range} as a human-readable string.
	 */
	format(this: void, range: SourceRange | undefined): string {
		if(range === undefined) {
			return '??-??';
		} else if(range[0] === range[2]) {
			if(range[1] === range[3]) {
				return `${range[0]}.${range[1]}`;
			} else {
				return `${range[0]}.${range[1]}-${range[3]}`;
			}
		}
		return `${range[0]}.${range[1]}-${range[2]}.${range[3]}`;
	},
	/**
	 * Returns the start position of a source range.
	 */
	getStart(this: void, range: SourceRange): SourcePosition {
		return [range[0], range[1]];
	},
	/**
	 * Returns the start line of a source range.
	 */
	getStartLine(this: void, range: SourceRange): number {
		return range[0];
	},
	/**
	 * Returns the end position of a source range.
	 */
	getEnd(this: void, range: SourceRange): SourcePosition {
		return [range[2], range[3]];
	},
	/**
	 * Returns the end line of a source range.
	 */
	getEndLine(this: void, range: SourceRange): number {
		return range[2];
	},
	/**
	 * Creates a source range from the given line and column numbers.
	 * @param sl - start line
	 * @param sc - start column
	 * @param el - end line
	 * @param ec - end column
	 */
	from(this: void, sl: number | string, sc: number | string, el: number | string = sl, ec: number | string = sc): SourceRange {
		return [Number(sl), Number(sc), Number(el), Number(ec)];
	},
	/**
	 * returns an invalid source range
	 */
	invalid(this: void): SourceRange {
		return [-1, -1, -1, -1];
	},
	/**
	 * Merges multiple source ranges into a single source range that spans from the earliest start to the latest end.
	 * If you are interested in combining overlapping ranges into a minimal set of ranges, see {@link combineRanges}.
	 * @throws if no ranges are provided
	 */
	merge(this: void, rs: (SourceRange | undefined)[]): SourceRange {
		const rsSafe: SourceRange[] = rs.filter(isNotUndefined);
		guard(rsSafe.length > 0, 'Cannot merge no ranges');
		return rsSafe.reduce(([sl, sc, el, ec], [nsl, nsc, nel, nec]) => [
			...(sl < nsl || (sl === nsl && sc < nsc) ? [sl, sc] : [nsl, nsc]),
			...(el > nel || (el === nel && ec > nec) ? [el, ec] : [nel, nec])
		] as SourceRange, rsSafe[0]);
	},
	/**
	 * @returns true iff `r1` starts and ends before `r2` starts (i.e., if `r1` and `r2` do not overlap and `r1` comes before `r2`
	 */
	startsCompletelyBefore(this: void, [,,r1el, r1ec]: SourceRange, [r2sl, r2sc,,]: SourceRange): boolean {
		return r1el < r2sl || (r1el === r2sl && r1ec < r2sc);
	},
	/**
	 * Checks if the two ranges overlap.
	 */
	overlap(this: void, [r1sl, r1sc, r1el, r1ec]: SourceRange, [r2sl, r2sc, r2el, r2ec]: SourceRange): boolean {
		return r1sl <= r2el && r2sl <= r1el && r1sc <= r2ec && r2sc <= r1ec;
	},
	/**
	 * Calculates the component-wise sum of two ranges.
	 */
	add(this: void, [r1sl, r1sc, r1el, r1ec]: SourceRange, [r2sl, r2sc, r2el, r2ec]: SourceRange): SourceRange {
		return [r1sl+r2sl, r1sc+r2sc, r1el+r2el, r1ec+r2ec];
	},
	/**
	 * Provides a comparator for {@link SourceRange}s that sorts them in ascending order.
	 * @returns a positive number if `r1` comes after `r2`, a negative number if `r1` comes before `r2`, and `0` if they are equal
	 */
	compare(this: void, [r1sl, r1sc,,]: SourceRange, [r2sl, r2sc,,]: SourceRange): number {
		if(r1sl === r2sl) {
			return r1sc - r2sc;
		} else {
			return r1sl - r2sl;
		}
	},
	/**
	 * Checks if the first range is a subset of the second range.
	 */
	isSubsetOf(this: void, [r1sl, r1sc, r1el, r1ec]: SourceRange, [r2sl, r2sc, r2el, r2ec]: SourceRange): boolean {
		return (r1sl > r2sl || r1sl === r2sl && r1sc >= r2sc) && (r1el < r2el || r1sl === r2sl && r1ec <= r2ec);
	},
	/**
	 * Combines overlapping or subset ranges into a minimal set of ranges.
	 * @see {@link SourceRange.merge} for merging multiple ranges into a single range.
	 */
	combineRanges(this: void, ...ranges: SourceRange[]): SourceRange[] {
		return ranges.filter(range => !ranges.some(other => range !== other && SourceRange.isSubsetOf(range, other)));
	},
	fromNode<OtherInfo>(this: void, node: RNode<OtherInfo> | undefined): SourceRange | undefined {
		return node?.info.fullRange ?? node?.location;
	}
} as const;

/**
 * A source location consisting of a source range and an optional file name.
 * @see {@link SourceLocation.format} and related utility functions for working with source locations.
 */
export type SourceLocation = [...r: SourceRange, f?: string];

/**
 * Utility functions for {@link SourceLocation|source locations}.
 */
export const SourceLocation = {
	/**
	 * Formats a {@link SourceLocation|source location} as a human-readable string.
	 */
	format(this: void, location: SourceLocation | undefined): string {
		if(location === undefined) {
			return '??:??-??';
		} else if(location[4] !== undefined) {
			return `${location[4]}:${SourceRange.format(location as SourceRange)}`;
		} else {
			return SourceRange.format(location as SourceRange);
		}
	},
	/**
	 * Returns the {@link SourceRange|source range} part of a {@link SourceLocation|source location}.
	 */
	getRange(this: void, location: SourceLocation): SourceRange {
		return location as SourceRange;
	},
	getFile(this: void, location: SourceLocation): string | undefined {
		return location[4];
	},
	/**
	 * Returns the file part of a {@link SourceLocation|source location}, or `undefined` if no file is set.
	 */
	from(this: void, range: SourceRange, file?: string): SourceLocation {
		return file !== undefined ? [...range, file] : range;
	},
	/**
	 * Creates a {@link SourceLocation|source location} from a {@link SourceRange|source range} and a file name.
	 * @returns undefined if the given range is undefined
	 * @see {@link SourceRange.fromNode} for getting the range from an AST node
	 */
	fromNode<OtherInfo>(this: void, node: RNode<OtherInfo>): SourceLocation | undefined {
		const range = SourceRange.fromNode(node);
		return range !== undefined ? SourceLocation.from(range, node.info.file) : undefined;
	},
	/**
	 * Maps the file part of a {@link SourceLocation|source location} using the given mapper function.
	 */
	mapFile(this: void, loc: SourceLocation, fileMapper: (file: string | undefined) => string): SourceLocation {
		const range = SourceLocation.getRange(loc);
		const file = loc[4];
		return SourceLocation.from(range, fileMapper(file));
	},
	/**
	 * Checks if the first location is a subset of the second location.
	 * For this, they must be in the same file!
	 * @see {@link SourceRange.isSubsetOf}
	 */
	isSubsetOf(this: void, loc1: SourceLocation, loc2: SourceLocation): boolean {
		if(SourceLocation.getFile(loc1) !== SourceLocation.getFile(loc2)) {
			return false;
		}
		return SourceRange.isSubsetOf(
			SourceLocation.getRange(loc1),
			SourceLocation.getRange(loc2)
		);
	},
	compare(this: void, loc1: SourceLocation, loc2: SourceLocation): number {
		const res = SourceRange.compare(
			SourceLocation.getRange(loc1),
			SourceLocation.getRange(loc2)
		);
		if(res !== 0) {
			return res;
		}
		const file1 = SourceLocation.getFile(loc1);
		const file2 = SourceLocation.getFile(loc2);
		if(file1 === file2) {
			return 0;
		} else if(file1 === undefined) {
			return -1;
		} else if(file2 === undefined) {
			return 1;
		} else {
			return file1 < file2 ? -1 : 1;
		}
	},
	/**
	 * Returns an invalid source location (i.e., with an invalid range and no file).
	 */
	invalid(this: void): SourceLocation {
		return SourceRange.invalid();
	},
	/**
	 * Merges multiple source locations into a single source location that spans from the earliest start to the latest end.
	 * If the locations are from different files, `undefined` is returned.
	 * Files may be `undefined` themselves, but if there is at least one defined file, they must all be the same defined file for the merge to succeed.
	 */
	merge(this: void, locs: (SourceLocation | undefined)[]): SourceLocation | undefined {
		const locsSafe: SourceLocation[] = locs.filter(isNotUndefined);
		if(locsSafe.length === 0) {
			return undefined;
		}
		const firstFile = locsSafe.find(loc => loc[4] !== undefined)?.[4];
		if(locsSafe.some(loc => loc[4] !== undefined && loc[4] !== firstFile)) {
			return undefined;
		}
		return SourceLocation.from(SourceRange.merge(locsSafe.map(SourceLocation.getRange)), firstFile);
	}
} as const;