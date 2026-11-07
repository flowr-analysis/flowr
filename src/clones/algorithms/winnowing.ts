/*
 * Winnowing (Schleimer, Wilkerson, and Aiken. "Winnowing: Local Algorithms for Document Fingerprinting",
 * SIGMOD 2003), the fingerprinting behind MOSS.
 *
 * Given a noise threshold `k` and a guarantee threshold `t >= k`, every k-gram is hashed and in each window of
 * `w = t - k + 1` consecutive hashes the minimum is selected. On ties, robust winnowing (Definition 3) keeps the
 * hash selected for the previous window if it is still in the window, and otherwise takes the rightmost minimum.
 * Any shared substring of at least `t` tokens is guaranteed to share a fingerprint, none shorter than `k` is found.
 */

/** A selected fingerprint: the k-gram hash and the index of the first token of the k-gram. */
export interface Fingerprint {
	readonly hash:     number;
	readonly position: number;
}

/**
 * The hashes of all k-grams of `tokens` (Karp-Rabin rolling hash modulo 2^32, as unsigned values).
 * There are `tokens.length - k + 1` hashes, and none if the sequence is shorter than `k`. Equal k-grams of
 * different sequences have equal hashes, and different k-grams may collide (it is a 32-bit hash).
 * {@link detectClones} uses them as a lossless prefilter, as two sequences with a shared run of `k` tokens share a hash.
 * @example
 * ```ts
 * kgramHashes(Int32Array.of(1, 2, 3, 4), 2).length; // 3
 * ```
 */
export function kgramHashes(tokens: Int32Array, k: number): Uint32Array {
	if(tokens.length < k || k <= 0) {
		return new Uint32Array(0);
	}
	const base = 0x01000193;
	// base^(k-1) mod 2^32
	let high = 1;
	for(let i = 1; i < k; i++) {
		high = Math.imul(high, base);
	}
	const out = new Uint32Array(tokens.length - k + 1);
	let h = 0;
	for(let i = 0; i < tokens.length; i++) {
		if(i >= k) {
			h = (h - Math.imul(tokens[i - k], high)) | 0;
		}
		h = (Math.imul(h, base) + tokens[i]) | 0;
		if(i >= k - 1) {
			out[i - k + 1] = h >>> 0;
		}
	}
	return out;
}

/**
 * Robust winnowing over the k-gram hashes `hashes` with window size `w`.
 * A port of the algorithm of Fig. 5 of the paper, with the change the paper states for robust winnowing: "the `<=`
 * comparison on line marked (*) should be replaced by `<`":
 * ```c
 * while (true) {
 *   r = (r + 1) % w; // shift the window by one
 *   h[r] = next_hash(); // and add one new hash
 *   if (min == r) {
 *     // The previous minimum is no longer in this window. Scan h leftward starting from r for the rightmost minimal hash.
 *     for(int i=(r-1+w)%w; i!=r; i=(i-1+w)%w)
 *       if (h[i] < h[min]) min = i;
 *     record(h[min], global_pos(min, r, w));
 *   } else {
 *     // Otherwise, the previous minimum is still in this window. Compare against the new value and update min if necessary.
 *     if (h[r] <= h[min]) { min = r; record(h[min], global_pos(min, r, w)); }
 *   }
 * }
 * ```
 * The pseudocode starts with a buffer of maximal hashes and so also selects in the partial windows before the first
 * full one; the paper's definition only considers full windows, so we select the rightmost minimum of the first full
 * window and continue from there. A sequence shorter than one window gets its rightmost minimum as its fingerprint.
 */
export function winnow(hashes: Uint32Array, w: number): Fingerprint[] {
	const result: Fingerprint[] = [];
	if(hashes.length === 0) {
		return result;
	}
	w = Math.max(1, w);
	const h = new Float64Array(w).fill(0xffffffff + 1);
	const pos = new Int32Array(w).fill(-1);
	const firstFull = Math.min(w, hashes.length) - 1;
	let r = 0;
	let min = 0;
	/* the rightmost minimum of the buffer, scanning leftward from `r` like the pseudocode does */
	const rightmostMin = () => {
		min = r;
		for(let i = (r - 1 + w) % w; i !== r; i = (i - 1 + w) % w) {
			if(h[i] < h[min]) {
				min = i;
			}
		}
	};
	for(let next = 0; next < hashes.length; next++) {
		r = (r + 1) % w;
		h[r] = hashes[next];
		pos[r] = next;
		if(next < firstFull) {
			continue;
		}
		if(next === firstFull || min === r) {
			rightmostMin();
			result.push({ hash: h[min], position: pos[min] });
		} else if(h[r] < h[min]) {
			min = r;
			result.push({ hash: h[min], position: pos[min] });
		}
	}
	return result;
}

/**
 * Fingerprints of a token sequence for noise threshold `k` and guarantee threshold `t`, with `t >= k`.
 * Matches shorter than `k` tokens are never found and each match of at least `t` tokens is, so raise `k` for fewer
 * false positives and lower `t` for more recall. Larger `t - k` windows select fewer fingerprints.
 * Compare the sets of `hash` values of two sequences (the Dice coefficient is the similarity of the `winnowing` detector).
 * @example
 * ```ts
 * const prints = fingerprints(tokenize(ast, CloneTokenization.Normalized).values, 5, 8);
 * const hashes = new Set(prints.map(p => p.hash));
 * ```
 */
export function fingerprints(tokens: Int32Array, k: number, t: number): Fingerprint[] {
	return winnow(kgramHashes(tokens, k), Math.max(1, t - k + 1));
}
