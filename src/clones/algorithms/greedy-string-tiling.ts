/*
 * Greedy String Tiling with Karp-Rabin matching (RKR-GST, Wise 1993), as implemented by JPlag.
 *
 * This is a port of JPlag (GPL-3.0, https://github.com/jplag/JPlag) at commit 3ee7de912b90ef82462fa1fbe0a57aa48b4e8f15:
 * `core/src/main/java/de/jplag/comparison/GreedyStringTiling.java` (compareOrdered, findLongestUnmarkedMatch,
 * addMatchIfNotOverlapping), `core/src/main/java/de/jplag/comparison/RollingTokenHashTable.java`, the overlap test
 * of `core/src/main/java/de/jplag/Match.java`, and the similarity measures of `core/src/main/java/de/jplag/JPlagComparison.java`.
 * Base code exclusion and match merging are not ported (both are off by default in JPlag).
 * Java `int` arithmetic is reproduced with `| 0`.
 */

/** A tile: `length` tokens starting at `left` in the first and at `right` in the second sequence. */
export interface GstMatch {
	readonly left:   number;
	readonly right:  number;
	readonly length: number;
}

const MaxHashLength = 25;
const HashModulo = 64;
const NoHash = -1;

/**
 * JPlag's `RollingTokenHashTable`: the hash of every window of `windowSize` tokens that contains no marked token,
 * and an index from hash to window starts. Built once per token sequence and reused across comparisons.
 */
export class RollingTokenHashTable {
	private readonly hashes: Int32Array | undefined;
	private readonly starts = new Map<number, number[]>();

	constructor(windowSize: number, tokens: Int32Array, marked: Uint8Array) {
		const w = Math.min(Math.max(windowSize, 1), MaxHashLength);
		if(tokens.length < w) {
			this.hashes = undefined;
			return;
		}
		const hashes = new Int32Array(tokens.length - w + 1);
		let hash = 0;
		let hashedLength = 0;
		for(let end = 0; end < tokens.length; end++) {
			const start = end - w;
			if(start >= 0) {
				if(hashedLength >= w) {
					hashes[start] = hash;
					let list = this.starts.get(hash);
					if(list === undefined) {
						list = [];
						this.starts.set(hash, list);
					}
					list.push(start);
				} else {
					hashes[start] = NoHash;
				}
				hash = (hash - ((tokens[start] % HashModulo) << (w - 1))) | 0;
			}
			hash = ((hash << 1) + (tokens[end] % HashModulo)) | 0;
			if(marked[end]) {
				hashedLength = 0;
			} else {
				hashedLength++;
			}
		}
		this.hashes = hashes;
	}

	hashAt(start: number): number {
		return this.hashes === undefined ? NoHash : this.hashes[start];
	}

	startsFor(hash: number): readonly number[] {
		return this.starts.get(hash) ?? [];
	}
}

/**
 * A token sequence prepared for {@link greedyStringTiling}: the tokens end with a pivot (JPlag's `FILE_END`) that is
 * excluded from matching, and the hash table for the minimum match length is cached.
 */
export interface GstSequence {
	readonly tokens:   Int32Array;
	/** 1 for tokens excluded from matching (the pivot) */
	readonly excluded: Uint8Array;
	table?:            RollingTokenHashTable;
}

/**
 * Prepares `tokens` (without pivot) for tiling, appending the pivot `pivot`.
 * Prepare each token string once and reuse the sequence for all comparisons it takes part in, as the hash
 * table for the minimum match length is cached on it. The sequence is only valid for one `minimumMatchLength` then.
 * @example
 * ```ts
 * const a = gstSequence(tokenize(astA, CloneTokenization.Jplag).values, FileEndToken);
 * const b = gstSequence(tokenize(astB, CloneTokenization.Jplag).values, FileEndToken);
 * ```
 */
export function gstSequence(tokens: Int32Array, pivot: number): GstSequence {
	const t = new Int32Array(tokens.length + 1);
	t.set(tokens);
	t[tokens.length] = pivot;
	const excluded = new Uint8Array(t.length);
	excluded[tokens.length] = 1;
	return { tokens: t, excluded };
}

function overlaps(a: GstMatch, b: GstMatch): boolean {
	if(a.left < b.left) {
		if(b.left - a.left < a.length) {
			return true;
		}
	} else if(a.left - b.left < b.length) {
		return true;
	}
	if(a.right < b.right) {
		return b.right - a.right < a.length;
	}
	return a.right - b.right < b.length;
}

function addMatchIfNotOverlapping(matches: GstMatch[], match: GstMatch): void {
	for(let i = matches.length - 1; i >= 0; i--) {
		if(overlaps(matches[i], match)) {
			return;
		}
	}
	matches.push(match);
}

function findLongestUnmarkedMatch(lv: Int32Array, ls: number, lm: Uint8Array, rv: Int32Array, rs: number, rm: Uint8Array, minimum: number): number {
	for(let offset = minimum - 1; offset >= 0; offset--) {
		const li = ls + offset, ri = rs + offset;
		if(lv[li] !== rv[ri] || lm[li] || rm[ri]) {
			return 0;
		}
	}
	let offset = minimum;
	while(lv[ls + offset] === rv[rs + offset] && !lm[ls + offset] && !rm[rs + offset]) {
		offset++;
	}
	return offset;
}

/**
 * JPlag's `compareOrdered`: tiles `left` (the shorter sequence, ties broken by the caller) with `right`.
 * Returns the tiles of at least `minimumMatchLength` tokens.
 * Pass the sequence with fewer tokens as `left` (as JPlag does) for results that equal JPlag's. The sequences are not
 * changed apart from the cached hash tables, so they can take part in many comparisons, but always with the same `minimumMatchLength`.
 * The worst case is cubic in the sequence lengths, so {@link detectClones} prefilters pairs by shared k-grams first.
 * @example
 * ```ts
 * const tiles = greedyStringTiling(a, b, 8); // [{ left, right, length }, ...]
 * const similarity = gstSimilarity(matchedTokens(tiles), a.tokens.length - 1, b.tokens.length - 1);
 * ```
 */
export function greedyStringTiling(left: GstSequence, right: GstSequence, minimumMatchLength: number): GstMatch[] {
	const lt = left.tokens, rt = right.tokens;
	const lm = left.excluded.slice(), rm = right.excluded.slice();
	left.table ??= new RollingTokenHashTable(minimumMatchLength, lt, left.excluded);
	right.table ??= new RollingTokenHashTable(minimumMatchLength, rt, right.excluded);
	const leftTable = left.table, rightTable = right.table;
	const globalMatches: GstMatch[] = [];
	let maximumMatchLength: number;
	do{
		maximumMatchLength = minimumMatchLength;
		const iterationMatches: GstMatch[] = [];
		for(let ls = 0; ls < lt.length - maximumMatchLength; ls++) {
			const hash = leftTable.hashAt(ls);
			if(lm[ls] || hash === NoHash) {
				continue;
			}
			for(const rs of rightTable.startsFor(hash)) {
				// `>=` because the last token is the pivot
				if(rm[rs] || maximumMatchLength >= rt.length - rs) {
					continue;
				}
				const length = findLongestUnmarkedMatch(lt, ls, lm, rt, rs, rm, maximumMatchLength);
				if(length >= maximumMatchLength) {
					if(length > maximumMatchLength) {
						iterationMatches.length = 0;
						maximumMatchLength = length;
					}
					addMatchIfNotOverlapping(iterationMatches, { left: ls, right: rs, length });
				}
			}
		}
		for(const match of iterationMatches) {
			// JPlag sorts matches shorter than minimumTokenMatch into ignoredMatches; without merging they cannot occur
			addMatchIfNotOverlapping(globalMatches, match);
			for(let o = 0; o < match.length; o++) {
				lm[match.left + o] = 1;
				rm[match.right + o] = 1;
			}
		}
	} while(maximumMatchLength !== minimumMatchLength);
	return globalMatches;
}

/**
 * The number of tokens covered by `matches` (on either side, as tiles have equal lengths).
 * @see {@link gstSimilarity}
 */
export function matchedTokens(matches: readonly GstMatch[]): number {
	let n = 0;
	for(const m of matches) {
		n += m.length;
	}
	return n;
}

/**
 * JPlag's `JPlagComparison.similarity()` without base code: `(matched of first + matched of second) / (|first| + |second|)`,
 * where the lengths exclude the pivot (`Submission.getSimilarityDivisor`). `matched` is
 * {@link matchedTokens} of the tiles and counts for both sides, so identical strings have similarity 1.
 * @example
 * ```ts
 * gstSimilarity(8, 10, 8); // 16 / 18
 * ```
 */
export function gstSimilarity(matched: number, lengthA: number, lengthB: number): number {
	const divisor = lengthA + lengthB;
	return divisor === 0 ? 0 : 2 * matched / divisor;
}
