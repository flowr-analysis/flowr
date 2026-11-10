import { kgramHashes } from './winnowing';

/** A tile: `length` tokens starting at `left` in the first and at `right` in the second sequence. */
export interface GstMatch {
	readonly left:   number;
	readonly right:  number;
	readonly length: number;
}

function overlaps(a: GstMatch, b: GstMatch): boolean {
	return (a.left < b.left ? b.left - a.left < a.length : a.left - b.left < b.length)
		|| (a.right < b.right ? b.right - a.right < a.length : a.right - b.right < b.length);
}

/**
 * Greedy String Tiling with Karp-Rabin matching (RKR-GST, Wise 1993) as JPlag's `GreedyStringTiling.compareOrdered`
 * (https://github.com/jplag/JPlag, without base code and match merging): in each round, the longest unmarked common
 * substrings of at least `minimumMatchLength` tokens become tiles and are marked, until only matches of the minimum length remain.
 * Pass the shorter sequence as `left`, as JPlag does.
 * @example
 * ```ts
 * greedyStringTiling([1, 2, 3, 4, 9], [9, 1, 2, 3, 4], 3); // [{ left: 0, right: 1, length: 4 }]
 * ```
 */
export function greedyStringTiling(left: ArrayLike<number>, right: ArrayLike<number>, minimumMatchLength: number): GstMatch[] {
	const lm = new Uint8Array(left.length), rm = new Uint8Array(right.length);
	const leftHashes = kgramHashes(left, minimumMatchLength);
	const rightStarts = new Map<number, number[]>();
	kgramHashes(right, minimumMatchLength).forEach((h, s) => rightStarts.get(h)?.push(s) ?? rightStarts.set(h, [s]));
	const tiles: GstMatch[] = [];
	let max: number;
	do{
		max = minimumMatchLength;
		let found: GstMatch[] = [];
		for(let ls = 0; ls < leftHashes.length; ls++) {
			for(const rs of lm[ls] ? [] : rightStarts.get(leftHashes[ls]) ?? []) {
				let length = 0;
				while(ls + length < left.length && rs + length < right.length && left[ls + length] === right[rs + length] && !lm[ls + length] && !rm[rs + length]) {
					length++;
				}
				if(length < max) {
					continue;
				} else if(length > max) {
					found = [];
					max = length;
				}
				const tile = { left: ls, right: rs, length };
				if(!found.some(t => overlaps(t, tile))) {
					found.push(tile);
				}
			}
		}
		for(const tile of found) {
			tiles.push(tile);
			lm.fill(1, tile.left, tile.left + tile.length);
			rm.fill(1, tile.right, tile.right + tile.length);
		}
	} while(max !== minimumMatchLength);
	return tiles;
}
