import { guard, isNotUndefined } from './assert';
import type { Accessor } from './accessor';
import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { RNodeWithParent } from '../r-bridge/lang-4.x/ast/model/processing/decorate';

/**
 * A source position in a file.
 *
 * Please note that some packages like `xmlparsedata` use their own start and end only to break ties
 * (e.g., `xmlparsedata` calculates them on a max col width approximation)
 * A position is a degenerate range, so the helpers live on {@link SourceRange}: {@link SourceRange.getStart},
 * {@link SourceRange.getEnd} hand one out and {@link SourceRange.formatPosition} prints it.
 * @see {@link SourceRange|source ranges} for describing ranges of source positions.
 */
export type SourcePosition = [
	/** starts with 1 */
	line:   number,
	/** starts with 1 */
	column: number
];

/**
 * **Please note** that for multi-file projects we also have a {@link SourceLocation|source location} type that includes the file name.
 * Describe the start and end {@link SourcePosition|source position} of an element.
 *
 * Every source range is also a valid {@link SourceLocation|source location} (one without a file),
 * so all readers below accept either.
 * @see {@link SourceRange.format} and related utility functions for working with source ranges.
 * @see {@link SourceRange.view} if you prefer property access (`range.startLine`) over these functions.
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
 * A source location consisting of a source range and an optional file name.
 * @see {@link SourceLocation.format} and related utility functions for working with source locations.
 * @see {@link SourceLocation.view} if you prefer property access (`loc.startLine`, `loc.file`) over these functions.
 */
export type SourceLocation = [...r: SourceRange, f?: string];

/**
 * Anything that denotes a place in the source: a plain tuple ({@link SourceRange} or {@link SourceLocation})
 * or a {@link SourceLocationView}. Accepted wherever a location is only read.
 */
export type SourceLocationLike = SourceLocation | SourceLocationView;

/** Unwraps a {@link SourceLocationView} to its backing tuple, passing tuples through unchanged. */
function raw(of: SourceLocationLike): SourceLocation;
function raw(of: SourceLocationLike | undefined): SourceLocation | undefined;
function raw(of: SourceLocationLike | undefined): SourceLocation | undefined {
	return of instanceof SourceLocationView ? of.raw : of;
}

/**
 * Utility functions for {@link SourceRange|source ranges}.
 */
export const SourceRange = {
	name: 'SourceRange',
	/**
	 * Prints a {@link SourceRange|range} as a human-readable string.
	 */
	format(this: void, range: SourceLocation | undefined): string {
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
	 * Prints a {@link SourcePosition|position} as a human-readable string.
	 */
	formatPosition(this: void, pos: SourcePosition | undefined): string {
		return pos === undefined ? '??.??' : `${pos[0]}.${pos[1]}`;
	},
	/**
	 * Returns the start position of a source range, or `undefined` if there is no range.
	 */
	getStart:       ((range?: SourceLocation) => range && [range[0], range[1]]) as Accessor<SourceLocation, SourcePosition>,
	/**
	 * Returns the start line of a source range, or `undefined` if there is no range.
	 */
	getStartLine:   ((range?: SourceLocation) => range?.[0]) as Accessor<SourceLocation, number>,
	/**
	 * Returns the start column of a source range, or `undefined` if there is no range.
	 */
	getStartColumn: ((range?: SourceLocation) => range?.[1]) as Accessor<SourceLocation, number>,
	/**
	 * Returns the end position of a source range, or `undefined` if there is no range.
	 */
	getEnd:         ((range?: SourceLocation) => range && [range[2], range[3]]) as Accessor<SourceLocation, SourcePosition>,
	/**
	 * Returns the end line of a source range, or `undefined` if there is no range.
	 */
	getEndLine:     ((range?: SourceLocation) => range?.[2]) as Accessor<SourceLocation, number>,
	/**
	 * Returns the end column of a source range, or `undefined` if there is no range.
	 */
	getEndColumn:   ((range?: SourceLocation) => range?.[3]) as Accessor<SourceLocation, number>,
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
	 * Whether the range is a real one, i.e., not the {@link SourceRange.invalid|invalid} range and not absent.
	 */
	isValid(this: void, range: SourceLocation | undefined): range is SourceLocation {
		return range !== undefined && range[0] >= 0 && range[1] >= 0 && range[2] >= 0 && range[3] >= 0;
	},
	/**
	 * Whether the range starts and ends on the same line.
	 */
	isSingleLine(this: void, range: SourceLocation): boolean {
		return range[0] === range[2];
	},
	/**
	 * The number of lines the range spans (always at least `1` for a valid range).
	 */
	lineCount(this: void, range: SourceLocation): number {
		return range[2] - range[0] + 1;
	},
	/**
	 * Merges multiple source ranges into a single source range that spans from the earliest start to the latest end.
	 * If you are interested in reducing a set of ranges to those none of the others contains, see {@link combineRanges}.
	 * @throws if no ranges are provided
	 */
	merge(this: void, rs: readonly (SourceLocation | undefined)[]): SourceRange {
		const rsSafe: SourceLocation[] = rs.filter(isNotUndefined);
		guard(rsSafe.length > 0, 'Cannot merge no ranges');
		return rsSafe.reduce<SourceRange>(([sl, sc, el, ec], [nsl, nsc, nel, nec]) => [
			...(sl < nsl || (sl === nsl && sc < nsc) ? [sl, sc] : [nsl, nsc]),
			...(el > nel || (el === nel && ec > nec) ? [el, ec] : [nel, nec])
		] as SourceRange, [rsSafe[0][0], rsSafe[0][1], rsSafe[0][2], rsSafe[0][3]]);
	},
	/**
	 * @returns true iff `r1` starts and ends before `r2` starts (i.e., if `r1` and `r2` do not overlap and `r1` comes before `r2`
	 */
	startsCompletelyBefore(this: void, [,,r1el, r1ec]: SourceLocation, [r2sl, r2sc,,]: SourceLocation): boolean {
		return r1el < r2sl || (r1el === r2sl && r1ec < r2sc);
	},
	/** Checks if the two ranges overlap, i.e. whether neither of them lies completely before the other. */
	overlap(this: void, r1: SourceLocation, r2: SourceLocation): boolean {
		return !SourceRange.startsCompletelyBefore(r1, r2) && !SourceRange.startsCompletelyBefore(r2, r1);
	},
	/**
	 * Calculates the component-wise sum of two ranges.
	 */
	add(this: void, [r1sl, r1sc, r1el, r1ec]: SourceLocation, [r2sl, r2sc, r2el, r2ec]: SourceLocation): SourceRange {
		return [r1sl + r2sl, r1sc + r2sc, r1el + r2el, r1ec + r2ec];
	},
	/**
	 * Provides a comparator for {@link SourceRange}s that sorts them in ascending order.
	 * @returns a positive number if `r1` comes after `r2`, a negative number if `r1` comes before `r2`, and `0` if they are equal
	 */
	compare(this: void, [r1sl, r1sc,,]: SourceLocation, [r2sl, r2sc,,]: SourceLocation): number {
		if(r1sl === r2sl) {
			return r1sc - r2sc;
		} else {
			return r1sl - r2sl;
		}
	},
	/**
	 * Checks if two ranges are equal (i.e., they start and end at the same position).
	 */
	equals(this: void, [r1sl, r1sc, r1el, r1ec]: SourceLocation, [r2sl, r2sc, r2el, r2ec]: SourceLocation): boolean {
		return r1sl === r2sl && r1sc === r2sc && r1el === r2el && r1ec === r2ec;
	},
	/**
	 * Checks if a given position (line, column) is contained within the range.
	 * Omitting the column checks whether the line is covered at all.
	 */
	containsPosition(this: void, [sl, sc, el, ec]: SourceLocation, line: number, column?: number): boolean {
		if(line < sl || line > el) {
			return false;
		} else if(column === undefined) {
			return true;
		} else if(sl === el) {
			return sc <= column && column <= ec;
		} else if(line === sl) {
			return column >= sc;
		} else if(line === el) {
			return column <= ec;
		}
		return true;
	},
	/**
	 * Checks if the first range is a subset of the second range.
	 */
	isSubsetOf(this: void, [r1sl, r1sc, r1el, r1ec]: SourceLocation, [r2sl, r2sc, r2el, r2ec]: SourceLocation): boolean {
		return (r1sl > r2sl || r1sl === r2sl && r1sc >= r2sc) && (r1el < r2el || r1el === r2el && r1ec <= r2ec);
	},
	/**
	 * Checks if the first range is a strict subset of the second range (i.e., it is a subset but not equal).
	 */
	isStrictSubsetOf(this: void, r1: SourceLocation, r2: SourceLocation): boolean {
		return SourceRange.isSubsetOf(r1, r2) && !SourceRange.equals(r1, r2);
	},
	/**
	 * Reduces the ranges to those no other one contains, keeping the first of any duplicates. Ranges that merely
	 * overlap are both kept, as neither contains the other. A non-empty input always yields a non-empty result.
	 * @see {@link SourceRange.merge} for merging multiple ranges into a single range.
	 */
	combineRanges(this: void, ...ranges: SourceRange[]): SourceRange[] {
		return ranges.filter((range, i) => !ranges.some((other, j) => i !== j
			&& (SourceRange.isStrictSubsetOf(range, other) || (j < i && SourceRange.equals(range, other)))));
	},
	fromNode<OtherInfo>(this: void, node: RNode<OtherInfo> | undefined): SourceRange | undefined {
		return node?.info.fullRange ?? node?.location;
	},
	/**
	 * Wraps the range in a {@link SourceLocationView|view} offering property access (`range.startLine`) and methods.
	 * The view does not copy the tuple; see {@link SourceLocationView} for when to use it.
	 */
	view: ((range?: SourceLocation) => range && new SourceLocationView(range)) as Accessor<SourceLocation, SourceLocationView>,
	/**
	 * "Fuzzy" position match, as opposed to requiring a node to *start* exactly at the position.
	 * @see {@link SourceRange.innermostNodes} to narrow the result down to the deepest matches
	 */
	nodesContaining<OtherInfo>(this: void, nodes: readonly RNodeWithParent<OtherInfo>[], line: number, column?: number): RNodeWithParent<OtherInfo>[] {
		return nodes.filter(node => {
			const range = SourceRange.fromNode(node);
			if(range === undefined) {
				return false;
			}
			return SourceRange.containsPosition(range, line, column);
		});
	},
	/**
	 * Collects all nodes satisfying the innermost condition: those containing no other of the given nodes.
	 *
	 * Nodes may share a range (a function call and the symbol naming it do), so `treatChildAsInner` decides that
	 * tie: with it, a node sharing its parent's range counts as the inner one and the parent drops out; without
	 * it, both are kept and the caller may pick between them (e.g. by node type).
	 *
	 * A non-empty input always yields a non-empty result: enclosure is a strict order so some node is always minimal,
	 * and a node carrying no range at all is kept rather than dropped.
	 * @see {@link SourceRange.nodesContaining} which this usually narrows down
	 */
	innermostNodes<OtherInfo>(this: void, nodes: readonly RNodeWithParent<OtherInfo>[], treatChildAsInner = true): RNodeWithParent<OtherInfo>[] {
		const result: RNodeWithParent<OtherInfo>[] = [];

		for(const node of nodes) {
			const range = SourceRange.fromNode(node);
			if(!range) {
				result.push(node);
				continue;
			}

			let inner = false;

			for(const other of nodes) {
				if(other === node) {
					continue;
				}

				const otherRange = SourceRange.fromNode(other);
				if(!otherRange) {
					continue;
				}

				if(SourceRange.isStrictSubsetOf(otherRange, range) ||
					(
						treatChildAsInner &&
						other.info.parent === node.info.id &&
						SourceRange.equals(otherRange, range)
					)
				) {
					inner = true;
					break;
				}
			}

			if(!inner) {
				result.push(node);
			}
		}

		return result.length > 0 ? result : nodes.slice();
	}
} as const;

/**
 * Utility functions for {@link SourceLocation|source locations}.
 *
 * As every {@link SourceRange} is a location without a file, the readers of {@link SourceRange} apply
 * to locations as well; the ones re-exported here save you the detour via {@link SourceLocation.getRange}.
 */
export const SourceLocation = {
	name: 'SourceLocation',
	/**
	 * Formats a {@link SourceLocation|source location} as a human-readable string.
	 */
	format(this: void, location: SourceLocation | undefined): string {
		if(location === undefined) {
			return '??:??-??';
		} else if(location[4] !== undefined) {
			return `${location[4]}:${SourceRange.format(location)}`;
		} else {
			return SourceRange.format(location);
		}
	},
	/** Returns the {@link SourceRange|source range} part of a {@link SourceLocation|source location}, file excluded. */
	getRange: ((loc?: SourceLocation) => loc && [loc[0], loc[1], loc[2], loc[3]]) as Accessor<SourceLocation, SourceRange>,
	/**
	 * Returns the file part of a {@link SourceLocation|source location}, or `undefined` if no file is set.
	 */
	getFile(this: void, location: SourceLocation | undefined): string | undefined {
		return location?.[4];
	},
	/** @see {@link SourceRange.getStart} */
	getStart:       SourceRange.getStart,
	/** @see {@link SourceRange.getStartLine} */
	getStartLine:   SourceRange.getStartLine,
	/** @see {@link SourceRange.getStartColumn} */
	getStartColumn: SourceRange.getStartColumn,
	/** @see {@link SourceRange.getEnd} */
	getEnd:         SourceRange.getEnd,
	/** @see {@link SourceRange.getEndLine} */
	getEndLine:     SourceRange.getEndLine,
	/** @see {@link SourceRange.getEndColumn} */
	getEndColumn:   SourceRange.getEndColumn,
	/** @see {@link SourceRange.isValid} */
	isValid:        SourceRange.isValid,
	/**
	 * Creates a {@link SourceLocation|source location} from a {@link SourceRange|source range} and a file name.
	 */
	from(this: void, range: SourceRange, file?: string): SourceLocation {
		return file !== undefined ? [...range, file] : range;
	},
	/**
	 * The {@link SourceLocation|source location} of an AST node, file included.
	 * @returns undefined if the given range is undefined
	 * @see {@link SourceRange.fromNode} for getting the range from an AST node
	 * @see {@link SourceLocation.at} for the same thing as a {@link SourceLocationView|view}
	 */
	fromNode<OtherInfo>(this: void, node: RNode<OtherInfo> | undefined): SourceLocation | undefined {
		const range = SourceRange.fromNode(node);
		return node !== undefined && range !== undefined ? SourceLocation.from(range, node.info.file) : undefined;
	},
	/**
	 * Wraps the location in a {@link SourceLocationView|view} offering property access (`loc.startLine`, `loc.file`) and methods.
	 * The view does not copy the tuple; see {@link SourceLocationView} for when to use it.
	 */
	view: SourceRange.view,
	/**
	 * The {@link SourceLocationView|view} on the location of an AST node, `undefined` if the node has none.
	 * Combines with optional chaining, so a single `?.` replaces the usual undefined dance:
	 * `SourceLocation.at(node)?.startLine`.
	 */
	at<OtherInfo>(this: void, node: RNode<OtherInfo> | undefined): SourceLocationView | undefined {
		return SourceLocation.view(SourceLocation.fromNode(node));
	},
	/**
	 * Maps the file part of a {@link SourceLocation|source location} using the given mapper function.
	 */
	mapFile(this: void, loc: SourceLocation, fileMapper: (file: string | undefined) => string): SourceLocation {
		return SourceLocation.from(SourceLocation.getRange(loc), fileMapper(loc[4]));
	},
	/**
	 * Checks if the first location is a subset of the second location.
	 * For this, they must be in the same file!
	 * @see {@link SourceRange.isSubsetOf}
	 */
	isSubsetOf(this: void, loc1: SourceLocation, loc2: SourceLocation): boolean {
		if(loc1[4] !== loc2[4]) {
			return false;
		}
		return SourceRange.isSubsetOf(loc1, loc2);
	},
	compare(this: void, loc1: SourceLocation, loc2: SourceLocation): number {
		const res = SourceRange.compare(loc1, loc2);
		if(res !== 0) {
			return res;
		}
		const file1 = loc1[4];
		const file2 = loc2[4];
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
	 * Checks if two locations are equal, file included.
	 */
	equals(this: void, loc1: SourceLocation, loc2: SourceLocation): boolean {
		return loc1[4] === loc2[4] && SourceRange.equals(loc1, loc2);
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
	merge(this: void, locs: readonly (SourceLocation | undefined)[]): SourceLocation | undefined {
		const locsSafe: SourceLocation[] = locs.filter(isNotUndefined);
		if(locsSafe.length === 0) {
			return undefined;
		}
		const firstFile = locsSafe.find(loc => loc[4] !== undefined)?.[4];
		if(locsSafe.some(loc => loc[4] !== undefined && loc[4] !== firstFile)) {
			return undefined;
		}
		return SourceLocation.from(SourceRange.merge(locsSafe), firstFile);
	}
} as const;

/**
 * An object-oriented read-only view on a {@link SourceLocation} (and hence on a {@link SourceRange}).
 *
 * The view holds a reference to the tuple it was created from and copies nothing, so it costs one small
 * object and every accessor is a plain tuple read. {@link SourceLocationView.toJSON|Serializing} it yields
 * the very tuple again, so a view may be handed to `JSON.stringify` in place of the location.
 *
 * Tuples remain the representation that is stored and sent over the wire; create a view where you *read*
 * a location and drop it afterwards rather than keeping one per node.
 * @example
 * ```ts
 * const loc = SourceLocation.at(node);
 * console.log(loc?.startLine, loc?.file, loc?.toString());
 * ```
 */
export class SourceLocationView {
	/** The underlying tuple; use it whenever you need the plain representation back. */
	readonly raw: SourceLocation;

	constructor(loc: SourceLocation) {
		this.raw = loc;
	}

	/** inclusive line the location starts on (starts with 1) */
	get startLine(): number {
		return this.raw[0];
	}

	/** inclusive column the location starts at (starts with 1) */
	get startColumn(): number {
		return this.raw[1];
	}

	/** inclusive line the location ends on */
	get endLine(): number {
		return this.raw[2];
	}

	/** inclusive column the location ends at */
	get endColumn(): number {
		return this.raw[3];
	}

	/** the file the location refers to, `undefined` for a plain {@link SourceRange} */
	get file(): string | undefined {
		return this.raw[4];
	}

	/** the inclusive start as a {@link SourcePosition} */
	get start(): SourcePosition {
		return [this.raw[0], this.raw[1]];
	}

	/** the inclusive end as a {@link SourcePosition} */
	get end(): SourcePosition {
		return [this.raw[2], this.raw[3]];
	}

	/** the {@link SourceRange} part, file excluded */
	get range(): SourceRange {
		return [this.raw[0], this.raw[1], this.raw[2], this.raw[3]];
	}

	/** @see {@link SourceRange.isValid} */
	get isValid(): boolean {
		return SourceRange.isValid(this.raw);
	}

	/** @see {@link SourceRange.isSingleLine} */
	get isSingleLine(): boolean {
		return this.raw[0] === this.raw[2];
	}

	/** @see {@link SourceRange.lineCount} */
	get lineCount(): number {
		return this.raw[2] - this.raw[0] + 1;
	}

	/** Whether the given position lies within this location; omitting the column checks the line alone. */
	contains(line: number, column?: number): boolean {
		return SourceRange.containsPosition(this.raw, line, column);
	}

	/** Whether `other` lies completely within this location, files ignored. */
	containsRange(other: SourceLocationLike): boolean {
		return SourceRange.isSubsetOf(raw(other), this.raw);
	}

	/** @see {@link SourceLocation.isSubsetOf} */
	isSubsetOf(other: SourceLocationLike): boolean {
		return SourceLocation.isSubsetOf(this.raw, raw(other));
	}

	/** @see {@link SourceRange.overlap} */
	overlaps(other: SourceLocationLike): boolean {
		return SourceRange.overlap(this.raw, raw(other));
	}

	/** @see {@link SourceRange.startsCompletelyBefore} */
	startsCompletelyBefore(other: SourceLocationLike): boolean {
		return SourceRange.startsCompletelyBefore(this.raw, raw(other));
	}

	/** @see {@link SourceLocation.equals} */
	equals(other: SourceLocationLike): boolean {
		return SourceLocation.equals(this.raw, raw(other));
	}

	/** @see {@link SourceLocation.compare} */
	compareTo(other: SourceLocationLike): number {
		return SourceLocation.compare(this.raw, raw(other));
	}

	/**
	 * The smallest location covering this one and all `others`, `undefined` if they are not in the same file.
	 * @see {@link SourceLocation.merge}
	 */
	merge(...others: readonly (SourceLocationLike | undefined)[]): SourceLocationView | undefined {
		return SourceLocation.view(SourceLocation.merge([this.raw, ...others.map(o => raw(o))]));
	}

	/** The same location, but attributed to the given file. */
	withFile(file: string | undefined): SourceLocationView {
		return new SourceLocationView(SourceLocation.from(this.range, file));
	}

	/** @see {@link SourceLocation.format} */
	toString(): string {
		return SourceLocation.format(this.raw);
	}

	/** Serializes to the underlying tuple, so a view is interchangeable with a location in JSON output. */
	toJSON(): SourceLocation {
		return this.raw;
	}

	/** Destructuring a view yields the same elements as destructuring the tuple. */
	[Symbol.iterator](): IterableIterator<number | string | undefined> {
		return this.raw[Symbol.iterator]();
	}
}
