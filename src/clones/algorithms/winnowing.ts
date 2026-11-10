/** A selected fingerprint: the k-gram hash and the index of the first token of the k-gram. */
export interface Fingerprint {
	readonly hash:     number;
	readonly position: number;
}

/**
 * The Karp-Rabin hashes (modulo 2^32, unsigned) of all `tokens.length - k + 1` k-grams of `tokens`.
 * @example
 * ```ts
 * kgramHashes([1, 2, 3, 4], 2).length; // 3
 * ```
 */
export function kgramHashes(tokens: ArrayLike<number>, k: number): Uint32Array {
	const out = new Uint32Array(k > 0 ? Math.max(0, tokens.length - k + 1) : 0);
	const base = 0x01000193;
	let high = 1;
	for(let i = 1; i < k; i++) {
		high = Math.imul(high, base);
	}
	for(let i = 0, h = 0; out.length > 0 && i < tokens.length; i++) {
		h = (Math.imul(i >= k ? (h - Math.imul(tokens[i - k], high)) | 0 : h, base) + tokens[i]) | 0;
		if(i >= k - 1) {
			out[i - k + 1] = h >>> 0;
		}
	}
	return out;
}

/**
 * Robust winnowing (Schleimer et al., SIGMOD 2003, Definition 3) with window size `w`: selects the rightmost minimum of
 * each window, unless the minimum selected for the previous window is still in it. A sequence shorter than one
 * window gets its rightmost minimum.
 */
export function winnow(hashes: Uint32Array, w: number): Fingerprint[] {
	const result: Fingerprint[] = [];
	w = Math.max(1, Math.min(w, hashes.length));
	let min = -1;
	for(let end = w - 1; end < hashes.length; end++) {
		if(min <= end - w) {
			min = end;
			for(let i = end - 1; i > end - w; i--) {
				if(hashes[i] < hashes[min]) {
					min = i;
				}
			}
		} else if(hashes[end] < hashes[min]) {
			min = end;
		} else {
			continue;
		}
		result.push({ hash: hashes[min], position: min });
	}
	return result;
}

/**
 * The winnowed fingerprints of `tokens`: every shared run of at least `t` tokens shares a fingerprint, and none shorter than `k` does.
 * @example
 * ```ts
 * const hashes = new Set(fingerprints(tokens, 5, 8).map(f => f.hash));
 * ```
 */
export function fingerprints(tokens: ArrayLike<number>, k: number, t: number): Fingerprint[] {
	return winnow(kgramHashes(tokens, k), t - k + 1);
}
