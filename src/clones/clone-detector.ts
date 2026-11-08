import type { MergeableRecord } from '../util/objects';
import { uniqueArray } from '../util/collections/arrays';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { SourceRange, type SourceLocation } from '../util/range';
import { type CloneAst, CloneTokenization, tokenize } from './clone-ast';
import type { CloneIndex } from './clone-index';
import { greedyStringTiling, gstSimilarity, matchedTokens } from './algorithms/greedy-string-tiling';
import { fingerprints, kgramHashes } from './algorithms/winnowing';
import { baxterClones, type SubtreeRef as Unit } from './algorithms/baxter-ast';

/**
 * The supported detectors:
 * - `baxter`: AST subtree hashing and comparison (Baxter et al., ICSM 1998)
 * - `gst`: Greedy String Tiling over token strings, as in JPlag (Prechelt et al., 2002)
 * - `winnowing`: k-gram fingerprinting as in MOSS (Schleimer et al., SIGMOD 2003)
 */
export enum CloneAlgorithm {
	Baxter    = 'baxter',
	Gst       = 'gst',
	Winnowing = 'winnowing'
}

/** Compare functions with each other, or whole files. */
export enum CloneUnit {
	Function = 'function',
	File     = 'file'
}

/** Which pairs may be reported: any two fragments, or only fragments in different files. */
export enum CloneScope {
	All       = 'all',
	CrossFile = 'cross-file'
}

interface TokenConfig extends MergeableRecord {
	readonly tokens:    CloneTokenization;
	/** the similarity a pair needs */
	readonly threshold: number;
	readonly unit:      CloneUnit;
}

export interface GstConfig extends TokenConfig {
	/** JPlag's `minimumTokenMatch` */
	readonly minimumMatchLength: number;
}

export interface WinnowingConfig extends TokenConfig {
	/** the noise threshold: the k-gram length */
	readonly k:                    number;
	/** the guarantee threshold: every shared run of at least `t` tokens is found */
	readonly t:                    number;
	/** fingerprints found in more units than this are ignored (MOSS's `-m`) */
	readonly maxDocumentFrequency: number;
}

export interface BaxterDetectionConfig extends MergeableRecord {
	readonly massThreshold:       number;
	readonly similarityThreshold: number;
}

export interface CloneDetectionConfig extends MergeableRecord {
	readonly algorithms: readonly CloneAlgorithm[];
	readonly scope:      CloneScope;
	/** report at most this many pairs per algorithm (the most similar ones), `0` for no limit */
	readonly maxPairs:   number;
	readonly gst:        GstConfig;
	readonly winnowing:  WinnowingConfig;
	readonly baxter:     BaxterDetectionConfig;
}

/**
 * The configuration {@link detectClones} falls back to: `gst` on functions. The thresholds of the algorithms are not comparable.
 * @example
 * ```ts
 * const config = { ...DefaultCloneDetectionConfig, gst: { ...DefaultCloneDetectionConfig.gst, threshold: 0.9 } };
 * ```
 */
export const DefaultCloneDetectionConfig: CloneDetectionConfig = {
	algorithms: [CloneAlgorithm.Gst],
	scope:      CloneScope.All,
	maxPairs:   1000,
	gst:        { tokens: CloneTokenization.Normalized, minimumMatchLength: 8, threshold: 0.8, unit: CloneUnit.Function },
	winnowing:  { tokens: CloneTokenization.Normalized, k: 5, t: 8, threshold: 0.6, maxDocumentFrequency: 50, unit: CloneUnit.Function },
	baxter:     { massThreshold: 30, similarityThreshold: 0.9 }
};

/** One side of a clone. */
export interface CloneFragment {
	readonly file:      string;
	readonly id:        NodeId;
	readonly loc:       SourceLocation;
	/** the function name, if the fragment is a named function */
	readonly name?:     string;
	/** set for fragments of the `against` index, whose ids belong to another analysis */
	readonly external?: true;
}

/** Two fragments an algorithm found to be clones. */
export interface ClonePair {
	readonly algorithm:    CloneAlgorithm;
	/** the symmetric similarity in [0, 1] */
	readonly similarity:   number;
	/** how much of `a` is found in `b` and vice versa */
	readonly containment?: readonly [aInB: number, bInA: number];
	readonly a:            CloneFragment;
	readonly b:            CloneFragment;
	/** the matched regions of the token-based algorithms */
	readonly matches?:     readonly { readonly a: SourceRange, readonly b: SourceRange }[];
}

export interface CloneDetectionStats extends MergeableRecord {
	readonly files:       number;
	/** compared units (subtrees for `baxter`) per algorithm */
	readonly units:       Partial<Record<CloneAlgorithm, number>>;
	/** pairs that passed the lossless filters and were compared in full */
	readonly comparisons: Partial<Record<CloneAlgorithm, number>>;
	readonly timing:      Partial<Record<CloneAlgorithm, number>>;
}

export interface CloneDetectionResult {
	readonly pairs: readonly ClonePair[];
	readonly stats: CloneDetectionStats;
}

/** the analyzed files followed by those of `against`, from index `own` on */
interface Corpus {
	readonly asts:   readonly CloneAst[];
	readonly own:    number;
	readonly config: CloneDetectionConfig;
	readonly stats:  { units: number, comparisons: number };
}

/** matched runs of two token strings: start in a, start in b, length in a, length in b */
type Run = readonly [number, number, number, number];

function units(c: Corpus, unit: CloneUnit): Unit[] {
	return c.asts.flatMap((ast, file) => unit === CloneUnit.File ? [{ file, node: 0 }] : ast.functions.map(f => ({ file, node: f.node })));
}

/** whether the pair may be reported: scope, sides, and neither fragment within the other */
function admissible(c: Corpus, a: Unit, b: Unit): boolean {
	if(c.own < c.asts.length && (a.file < c.own) === (b.file < c.own)) {
		return false;
	} else if(a.file !== b.file) {
		return true;
	}
	const size = c.asts[a.file].size;
	return c.config.scope !== CloneScope.CrossFile && (a.node + size[a.node] <= b.node || b.node + size[b.node] <= a.node);
}

function fragment(c: Corpus, { file, node }: Unit): CloneFragment {
	const ast = c.asts[file], s = ast.span, p = 4 * node;
	const name = ast.functions.find(f => f.node === node)?.name;
	return { file: ast.file, id: ast.id[node], loc: [s[p], s[p + 1], s[p + 2], s[p + 3], ast.file], ...(name ? { name } : {}), ...(file >= c.own ? { external: true } : {}) };
}

/** the source covered by the nodes `[from, to)`: whole subtrees within it, the start of all others */
function range(ast: CloneAst, from: number, to: number): SourceRange {
	const s = ast.span, rs: SourceRange[] = [];
	for(let n = from; n < to; n++) {
		const p = 4 * n;
		if(s[p] !== 0) {
			rs.push(n + ast.size[n] <= to ? [s[p], s[p + 1], s[p + 2], s[p + 3]] : [s[p], s[p + 1], s[p], s[p + 1]]);
		}
	}
	return rs.length > 0 ? SourceRange.merge(rs) : SourceRange.invalid();
}

function pair(c: Corpus, algorithm: CloneAlgorithm, a: Unit, b: Unit, similarity: number, containment: readonly [number, number], runs: readonly Run[]): ClonePair {
	const [x, y] = [c.asts[a.file], c.asts[b.file]];
	const matches = runs.map(([i, j, la, lb]) => ({ a: range(x, a.node + i, a.node + i + la), b: range(y, b.node + j, b.node + j + lb) }));
	return { algorithm, similarity, containment, a: fragment(c, a), b: fragment(c, b), matches };
}

/**
 * Calls `visit(i, j)`, `i < j`, once per admissible pair of units sharing a key, unless the lengths alone rule out the
 * threshold (the similarity is at most `2 min(li, lj) / (li + lj)`).
 */
function candidates(c: Corpus, us: readonly Unit[], keys: readonly ArrayLike<number>[], lengths: readonly number[], threshold: number, visit: (i: number, j: number) => void): void {
	const postings = new Map<number, number[]>();
	for(let u = 0; u < keys.length; u++) {
		for(let x = 0; x < keys[u].length; x++) {
			const p = postings.get(keys[u][x]);
			if(p === undefined) {
				postings.set(keys[u][x], [u]);
			} else if(p[p.length - 1] !== u) {
				p.push(u);
			}
		}
	}
	const seen = new Int32Array(keys.length).fill(-1);
	c.stats.units = us.length;
	for(let i = 0; i < keys.length; i++) {
		for(let x = 0; x < keys[i].length; x++) {
			for(const j of postings.get(keys[i][x]) ?? []) {
				if(j <= i || seen[j] === i) {
					continue;
				}
				seen[j] = i;
				if(2 * Math.min(lengths[i], lengths[j]) / (lengths[i] + lengths[j]) >= threshold && admissible(c, us[i], us[j])) {
					c.stats.comparisons++;
					visit(i, j);
				}
			}
		}
	}
}

function detectGst(c: Corpus): ClonePair[] {
	const cfg = c.config.gst;
	const us = units(c, cfg.unit);
	const tokens = us.map(u => tokenize(c.asts[u.file], cfg.tokens, u.node));
	const pairs: ClonePair[] = [];
	// a tile of at least `minimumMatchLength` tokens shares a k-gram
	candidates(c, us, tokens.map(t => kgramHashes(t, cfg.minimumMatchLength)), tokens.map(t => t.length), cfg.threshold, (i, j) => {
		const [l, r] = tokens[j].length < tokens[i].length ? [j, i] : [i, j];
		const tiles = greedyStringTiling(tokens[l], tokens[r], cfg.minimumMatchLength);
		const matched = matchedTokens(tiles);
		const similarity = gstSimilarity(matched, tokens[l].length, tokens[r].length);
		if(similarity >= cfg.threshold) {
			pairs.push(pair(c, CloneAlgorithm.Gst, us[l], us[r], similarity, [matched / tokens[l].length, matched / tokens[r].length], tiles.map(t => [t.left, t.right, t.length, t.length])));
		}
	});
	return pairs;
}

function detectWinnowing(c: Corpus): ClonePair[] {
	const cfg = c.config.winnowing;
	const us = units(c, cfg.unit);
	const all = us.map(u => fingerprints(tokenize(c.asts[u.file], cfg.tokens, u.node), cfg.k, cfg.t));
	const frequency = new Map<number, number>();
	const sets = all.map(ps => new Set(ps.map(p => p.hash)));
	sets.forEach(s => s.forEach(h => frequency.set(h, (frequency.get(h) ?? 0) + 1)));
	const prints = all.map(ps => ps.filter(p => (frequency.get(p.hash) ?? 0) <= cfg.maxDocumentFrequency));
	const keys = prints.map(ps => uniqueArray(ps.map(p => p.hash)));
	const pairs: ClonePair[] = [];
	candidates(c, us, keys, keys.map(k => k.length), cfg.threshold, (i, j) => {
		const inJ = new Map<number, number>();
		prints[j].forEach(p => inJ.has(p.hash) || inJ.set(p.hash, p.position));
		const shared = keys[i].filter(h => inJ.has(h)).length;
		const similarity = 2 * shared / (keys[i].length + keys[j].length);
		if(similarity < cfg.threshold) {
			return;
		}
		// MOSS-style passages: the k-grams of shared fingerprints, merged where they touch on both sides
		const runs: [number, number, number, number][] = [];
		for(const p of prints[i]) {
			const q = inJ.get(p.hash);
			const last = runs.at(-1);
			if(q === undefined) {
				continue;
			} else if(last && p.position <= last[0] + last[2] && q >= last[1] && q <= last[1] + last[3]) {
				last[2] = Math.max(last[2], p.position + cfg.k - last[0]);
				last[3] = Math.max(last[3], q + cfg.k - last[1]);
			} else {
				runs.push([p.position, q, cfg.k, cfg.k]);
			}
		}
		pairs.push(pair(c, CloneAlgorithm.Winnowing, us[i], us[j], similarity, [shared / keys[i].length, shared / keys[j].length], runs));
	});
	return pairs;
}

function detectBaxter(c: Corpus): ClonePair[] {
	const found = baxterClones(c.asts, c.config.baxter);
	c.stats.units = found.subtrees;
	c.stats.comparisons = found.comparisons;
	return found.pairs.filter(p => admissible(c, p.a, p.b)).map(p => ({ algorithm: CloneAlgorithm.Baxter, similarity: p.similarity, a: fragment(c, p.a), b: fragment(c, p.b) }));
}

const Detectors: Record<CloneAlgorithm, (c: Corpus) => ClonePair[]> = {
	[CloneAlgorithm.Baxter]:    detectBaxter,
	[CloneAlgorithm.Gst]:       detectGst,
	[CloneAlgorithm.Winnowing]: detectWinnowing
};

/**
 * Runs the configured algorithms on the index. With `against`, only pairs of a fragment of `index` and one of
 * `against` (whose fragments are marked `external`) are reported. Each algorithm reports at most `maxPairs` pairs.
 * @param index   - the code to check, built with {@link CloneIndex.build}
 * @param config  - see {@link DefaultCloneDetectionConfig}
 * @param against - an index of the same perspective to search `index` in, e.g., from {@link CloneIndex.deserialize}
 * @example
 * ```ts
 * const { pairs } = detectClones(await CloneIndex.build(analyzer, { perspective: ClonePerspective.Canonical }), DefaultCloneDetectionConfig);
 * ```
 */
export function detectClones(index: CloneIndex, config: CloneDetectionConfig, against?: CloneIndex): CloneDetectionResult {
	const asts = [...index.files, ...against?.files ?? []];
	const pairs: ClonePair[] = [];
	const stats: CloneDetectionStats = { files: asts.length, units: {}, comparisons: {}, timing: {} };
	for(const algorithm of new Set(config.algorithms)) {
		const detector = Detectors[algorithm] as ((c: Corpus) => ClonePair[]) | undefined;
		if(detector === undefined) {
			throw new Error(`unknown clone detection algorithm ${String(algorithm)}, use one of ${Object.values(CloneAlgorithm).join(', ')}`);
		}
		const start = performance.now();
		const c: Corpus = { asts, own: against ? index.files.length : asts.length, config, stats: { units: 0, comparisons: 0 } };
		const found = detector(c);
		pairs.push(...config.maxPairs > 0 && found.length > config.maxPairs ? found.sort((x, y) => y.similarity - x.similarity).slice(0, config.maxPairs) : found);
		stats.units[algorithm] = c.stats.units;
		stats.comparisons[algorithm] = c.stats.comparisons;
		stats.timing[algorithm] = performance.now() - start;
	}
	return { pairs, stats };
}
