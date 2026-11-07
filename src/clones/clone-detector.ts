import { uniqueArray } from '../util/collections/arrays';
import type { MergeableRecord } from '../util/objects';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SourceLocation, SourceRange } from '../util/range';
import { type CloneAst, CloneNodeKind } from './clone-ast';
import type { CloneIndex } from './clone-index';
import { CloneTokenization, type CloneTokens, FileEndToken, tokenize } from './clone-tokens';
import { greedyStringTiling, gstSequence, type GstSequence, gstSimilarity, matchedTokens } from './algorithms/greedy-string-tiling';
import { fingerprints, kgramHashes } from './algorithms/winnowing';
import { baxterClones } from './algorithms/baxter-ast';
import { type Pdg, similarCompare, similarSizeBound } from './algorithms/similar';

/**
 * The supported detectors:
 * - `baxter`: AST subtree hashing and comparison (Baxter et al., ICSM 1998)
 * - `gst`: Greedy String Tiling over token strings, ported from JPlag (Prechelt et al., 2002)
 * - `winnowing`: k-gram fingerprinting as in MOSS (Schleimer et al., SIGMOD 2003)
 * - `similar`: program dependence graph comparison of SimilaR (Bartoszuk and Gagolewski, The R Journal 2020)
 */
export enum CloneAlgorithm {
	Baxter    = 'baxter',
	Gst       = 'gst',
	Winnowing = 'winnowing',
	Similar   = 'similar'
}

/** Compare functions with each other, or whole files. */
export enum CloneUnit {
	Function = 'function',
	File     = 'file'
}

/** Which pairs may be reported. */
export enum CloneScope {
	/** any two fragments, also within one file */
	All       = 'all',
	/** only fragments in different files */
	CrossFile = 'cross-file'
}

export interface GstConfig extends MergeableRecord {
	readonly tokens:             CloneTokenization;
	/** JPlag's `minimumTokenMatch`, 8 in JPlag's R module */
	readonly minimumMatchLength: number;
	/** JPlag's average similarity a pair needs to be reported, greater than 0 (units sharing no tile are never compared) */
	readonly threshold:          number;
	readonly unit:               CloneUnit;
}

export interface WinnowingConfig extends MergeableRecord {
	readonly tokens:               CloneTokenization;
	/** noise threshold: the k-gram length */
	readonly k:                    number;
	/** guarantee threshold: every shared run of at least `t` tokens is found */
	readonly t:                    number;
	/** the Dice coefficient of the two fingerprint sets a pair needs */
	readonly threshold:            number;
	/**
	 * fingerprints found in more units than this are ignored (MOSS's `-m`, which defaults to 10 there); a function
	 * with more copies than this shares only ignored fingerprints with them, so we default to a higher limit
	 */
	readonly maxDocumentFrequency: number;
	readonly unit:                 CloneUnit;
}

export interface BaxterDetectionConfig extends MergeableRecord {
	readonly massThreshold:       number;
	readonly similarityThreshold: number;
}

export interface SimilarConfig extends MergeableRecord {
	/** number of relabeling iterations `h`, 3 in the paper */
	readonly iterations:      number;
	/** the symmetric similarity mu a pair needs */
	readonly threshold:       number;
	/** functions with fewer PDG vertices are skipped */
	readonly minimumVertices: number;
}

export interface CloneDetectionConfig extends MergeableRecord {
	readonly algorithms: readonly CloneAlgorithm[];
	readonly scope:      CloneScope;
	/** report at most this many pairs per algorithm (the most similar ones), `0` for no limit; `n` copies of one function are `n(n-1)/2` pairs */
	readonly maxPairs:   number;
	readonly gst:        GstConfig;
	readonly winnowing:  WinnowingConfig;
	readonly baxter:     BaxterDetectionConfig;
	readonly similar:    SimilarConfig;
}

export const DefaultCloneDetectionConfig: CloneDetectionConfig = {
	algorithms: [CloneAlgorithm.Gst],
	scope:      CloneScope.All,
	maxPairs:   1000,
	gst:        { tokens: CloneTokenization.Jplag, minimumMatchLength: 8, threshold: 0.8, unit: CloneUnit.Function },
	winnowing:  { tokens: CloneTokenization.Normalized, k: 5, t: 8, threshold: 0.6, maxDocumentFrequency: 50, unit: CloneUnit.Function },
	baxter:     { massThreshold: 30, similarityThreshold: 0.9 },
	similar:    { iterations: 3, threshold: 0.8, minimumVertices: 5 }
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
	/** the algorithm's symmetric similarity in [0, 1] */
	readonly similarity:   number;
	/** how much of `a` is found in `b` and vice versa, for algorithms that have an asymmetric measure */
	readonly containment?: readonly [aInB: number, bInA: number];
	readonly a:            CloneFragment;
	readonly b:            CloneFragment;
	/** the matched regions (tiles/passages) of token-based algorithms */
	readonly matches?:     readonly { readonly a: SourceRange, readonly b: SourceRange }[];
}

export interface CloneDetectionStats extends MergeableRecord {
	readonly files:       number;
	/** compared units (or subtrees for `baxter`) per algorithm */
	readonly units:       Partial<Record<CloneAlgorithm, number>>;
	/** pairs that passed all lossless filters and were compared in full */
	readonly comparisons: Partial<Record<CloneAlgorithm, number>>;
	readonly timing:      Partial<Record<CloneAlgorithm, number>>;
}

export interface CloneDetectionResult {
	readonly pairs: readonly ClonePair[];
	readonly stats: CloneDetectionStats;
}

/** A comparable unit: a function or a whole file. */
interface Unit {
	readonly file:      number;
	readonly node:      number;
	/** 0 for the analyzed index, 1 for the `against` index */
	readonly side:      number;
	readonly function?: number;
}

/** an index with an `against` index appended; `side` tells them apart */
interface Corpus {
	readonly asts:  readonly CloneAst[];
	readonly pdgs:  readonly (readonly Pdg[] | undefined)[];
	readonly side:  readonly number[];
	readonly cross: boolean;
}

function corpus(index: CloneIndex, against: CloneIndex | undefined): Corpus {
	const asts = against ? [...index.files, ...against.files] : index.files;
	const pdgs = [...index.files.map((_, i) => index.pdgs?.[i]), ...against?.files.map((_, i) => against.pdgs?.[i]) ?? []];
	const side = asts.map((_, i) => i < index.files.length ? 0 : 1);
	return { asts, pdgs, side, cross: against !== undefined };
}

function units(c: Corpus, unit: CloneUnit): Unit[] {
	const out: Unit[] = [];
	for(let f = 0; f < c.asts.length; f++) {
		const ast = c.asts[f];
		if(unit === CloneUnit.File) {
			if(ast.kind.length > 0) {
				out.push({ file: f, node: 0, side: c.side[f] });
			}
		} else {
			ast.functions.forEach((fn, k) => out.push({ file: f, node: fn.node, side: c.side[f], function: k }));
		}
	}
	return out;
}

/** whether the pair may be reported at all: scope, sides, and no containment of one fragment in the other */
function admissible(c: Corpus, config: CloneDetectionConfig, a: Unit, b: Unit): boolean {
	if(c.cross && a.side === b.side) {
		return false;
	}
	if(a.file !== b.file) {
		return true;
	}
	if(config.scope === CloneScope.CrossFile) {
		return false;
	}
	const size = c.asts[a.file].size;
	return !(a.node <= b.node && b.node < a.node + size[a.node]) && !(b.node <= a.node && a.node < b.node + size[b.node]);
}

function location(ast: CloneAst, node: number): SourceLocation {
	const s = ast.span, p = 4 * node;
	return [s[p], s[p + 1], s[p + 2], s[p + 3], ast.file];
}

function fragment(c: Corpus, file: number, node: number): CloneFragment {
	const ast = c.asts[file];
	const name = ast.kind[node] === CloneNodeKind.FunctionDefinition ? ast.functions.find(f => f.node === node)?.name : undefined;
	return { file: ast.file, id: ast.id[node], loc: location(ast, node), ...(name ? { name } : {}), ...(c.side[file] === 1 ? { external: true } : {}) };
}

/**
 * The source range covered by the tokens `[from, from + length)`: a token stands for the start of its node, an exit
 * token for its end, and a leaf token for the whole leaf.
 */
function tokenRange(ast: CloneAst, tokens: CloneTokens, from: number, length: number): SourceRange {
	const s = ast.span;
	let sl = 0, sc = 0, el = 0, ec = 0;
	for(let t = from; t < from + length; t++) {
		const node = tokens.nodes[t];
		const p = 4 * node;
		if(s[p] === 0) {
			continue;
		}
		const exit = tokens.exits[t] === 1;
		const [bl, bc] = exit ? [s[p + 2], s[p + 3]] : [s[p], s[p + 1]];
		const [fl, fc] = exit || ast.size[node] === 1 ? [s[p + 2], s[p + 3]] : [s[p], s[p + 1]];
		if(sl === 0 || bl < sl || (bl === sl && bc < sc)) {
			sl = bl;
			sc = bc;
		}
		if(fl > el || (fl === el && fc > ec)) {
			el = fl;
			ec = fc;
		}
	}
	return [sl, sc, el, ec];
}

function limitPairs(pairs: ClonePair[], max: number): ClonePair[] {
	if(max <= 0 || pairs.length <= max) {
		return pairs;
	}
	return pairs.sort((x, y) => y.similarity - x.similarity).slice(0, max);
}

/**
 * Candidate pairs `(i, j)`, `i < j`, of units sharing at least one key, each pair once.
 * `keys[u]` are the (deduplicated or not) keys of unit `u`; keys in more than `maxFrequency` units are skipped.
 */
function sharedKeyCandidates(keys: readonly ArrayLike<number>[], maxFrequency: number, visit: (i: number, j: number) => void): void {
	const postings = new Map<number, number[]>();
	for(let u = 0; u < keys.length; u++) {
		const ks = keys[u];
		for(let x = 0; x < ks.length; x++) {
			let p = postings.get(ks[x]);
			if(p === undefined) {
				p = [];
				postings.set(ks[x], p);
			}
			if(p[p.length - 1] !== u) {
				p.push(u);
			}
		}
	}
	const seen = new Int32Array(keys.length).fill(-1);
	for(let i = 0; i < keys.length; i++) {
		const ks = keys[i];
		for(let x = 0; x < ks.length; x++) {
			const p = postings.get(ks[x]);
			if(p === undefined || p.length > maxFrequency) {
				continue;
			}
			for(const j of p) {
				if(j > i && seen[j] !== i) {
					seen[j] = i;
					visit(i, j);
				}
			}
		}
	}
}

function detectGst(c: Corpus, config: CloneDetectionConfig, stats: { units: number, comparisons: number }): ClonePair[] {
	const cfg = config.gst;
	const us = units(c, cfg.unit);
	const tokens = us.map(u => tokenize(c.asts[u.file], cfg.tokens, u.node));
	const k = Math.max(1, cfg.minimumMatchLength);
	// lossless prefilter: a tile of >= k tokens shares at least one k-gram
	const grams = tokens.map(t => kgramHashes(t.values, k));
	const seqs = new Array<GstSequence | undefined>(us.length);
	stats.units = us.length;
	const pairs: ClonePair[] = [];
	sharedKeyCandidates(grams, Number.POSITIVE_INFINITY, (i, j) => {
		const ni = tokens[i].values.length, nj = tokens[j].values.length;
		if(2 * Math.min(ni, nj) / (ni + nj) < cfg.threshold || !admissible(c, config, us[i], us[j])) {
			return;
		}
		stats.comparisons++;
		seqs[i] ??= gstSequence(tokens[i].values, FileEndToken);
		seqs[j] ??= gstSequence(tokens[j].values, FileEndToken);
		// JPlag puts the submission with fewer tokens first (ties: by name)
		const swap = nj < ni || (nj === ni && j < i);
		const [l, r] = swap ? [j, i] : [i, j];
		const matches = greedyStringTiling(seqs[l] as GstSequence, seqs[r] as GstSequence, cfg.minimumMatchLength);
		const matched = matchedTokens(matches);
		const similarity = gstSimilarity(matched, ni, nj);
		if(similarity < cfg.threshold) {
			return;
		}
		const al = c.asts[us[l].file], ar = c.asts[us[r].file];
		pairs.push({
			algorithm:   CloneAlgorithm.Gst,
			similarity,
			containment: [matched / tokens[l].values.length, matched / tokens[r].values.length],
			a:           fragment(c, us[l].file, us[l].node),
			b:           fragment(c, us[r].file, us[r].node),
			matches:     matches.map(m => ({ a: tokenRange(al, tokens[l], m.left, m.length), b: tokenRange(ar, tokens[r], m.right, m.length) }))
		});
	});
	return pairs;
}

function detectWinnowing(c: Corpus, config: CloneDetectionConfig, stats: { units: number, comparisons: number }): ClonePair[] {
	const cfg = config.winnowing;
	const us = units(c, cfg.unit);
	const tokens = us.map(u => tokenize(c.asts[u.file], cfg.tokens, u.node));
	const all = tokens.map(t => fingerprints(t.values, cfg.k, cfg.t));
	// like MOSS's `-m`, fingerprints found in too many units are ignored entirely, for candidates and scores alike
	const frequency = new Map<number, number>();
	for(const ps of all) {
		for(const h of uniqueArray(ps.map(p => p.hash))) {
			frequency.set(h, (frequency.get(h) ?? 0) + 1);
		}
	}
	const prints = all.map(ps => ps.filter(p => (frequency.get(p.hash) ?? 0) <= cfg.maxDocumentFrequency));
	const sets = prints.map(ps => uniqueArray(ps.map(p => p.hash)).sort((x, y) => x - y));
	stats.units = us.length;
	const pairs: ClonePair[] = [];
	sharedKeyCandidates(sets, Number.POSITIVE_INFINITY, (i, j) => {
		const si = sets[i], sj = sets[j];
		if(si.length === 0 || sj.length === 0 || 2 * Math.min(si.length, sj.length) / (si.length + sj.length) < cfg.threshold || !admissible(c, config, us[i], us[j])) {
			return;
		}
		stats.comparisons++;
		const shared = new Set<number>();
		for(let x = 0, y = 0; x < si.length && y < sj.length;) {
			if(si[x] === sj[y]) {
				shared.add(si[x]);
				x++;
				y++;
			} else if(si[x] < sj[y]) {
				x++;
			} else {
				y++;
			}
		}
		const similarity = 2 * shared.size / (si.length + sj.length);
		if(similarity < cfg.threshold) {
			return;
		}
		pairs.push({
			algorithm:   CloneAlgorithm.Winnowing,
			similarity,
			containment: [shared.size / si.length, shared.size / sj.length],
			a:           fragment(c, us[i].file, us[i].node),
			b:           fragment(c, us[j].file, us[j].node),
			matches:     passages(c, us[i], us[j], tokens[i], tokens[j], prints[i], prints[j], shared, cfg.k)
		});
	});
	return pairs;
}

/** MOSS-style passages: the k-grams of shared fingerprints, merged where they touch on both sides */
function passages(c: Corpus, a: Unit, b: Unit, na: CloneTokens, nb: CloneTokens, pa: readonly { hash: number, position: number }[], pb: readonly { hash: number, position: number }[], shared: ReadonlySet<number>, k: number): { a: SourceRange, b: SourceRange }[] {
	const firstInB = new Map<number, number>();
	for(const p of pb) {
		if(shared.has(p.hash) && !firstInB.has(p.hash)) {
			firstInB.set(p.hash, p.position);
		}
	}
	const runs: [number, number, number, number][] = [];
	for(const p of pa) {
		const q = firstInB.get(p.hash);
		if(q === undefined) {
			continue;
		}
		const last = runs[runs.length - 1];
		if(last && p.position <= last[1] && q >= last[2] && q <= last[3]) {
			last[1] = Math.max(last[1], p.position + k);
			last[3] = Math.max(last[3], q + k);
		} else {
			runs.push([p.position, p.position + k, q, q + k]);
		}
	}
	const aa = c.asts[a.file], ab = c.asts[b.file];
	return runs.map(([as, ae, bs, be]) => ({ a: tokenRange(aa, na, as, ae - as), b: tokenRange(ab, nb, bs, be - bs) }));
}

function detectBaxter(c: Corpus, config: CloneDetectionConfig, stats: { units: number, comparisons: number }): ClonePair[] {
	const found = baxterClones(c.asts, config.baxter);
	stats.units = found.subtrees;
	stats.comparisons = found.comparisons;
	const pairs: ClonePair[] = [];
	for(const p of found.pairs) {
		const a: Unit = { file: p.a.file, node: p.a.node, side: c.side[p.a.file] };
		const b: Unit = { file: p.b.file, node: p.b.node, side: c.side[p.b.file] };
		if(admissible(c, config, a, b)) {
			pairs.push({ algorithm: CloneAlgorithm.Baxter, similarity: p.similarity, a: fragment(c, a.file, a.node), b: fragment(c, b.file, b.node) });
		}
	}
	return pairs;
}

function detectSimilar(c: Corpus, config: CloneDetectionConfig, stats: { units: number, comparisons: number }): ClonePair[] {
	const cfg = config.similar;
	const us = units(c, CloneUnit.Function).filter(u => {
		const pdg = c.pdgs[u.file]?.[u.function as number];
		return pdg !== undefined && pdg.color.length >= cfg.minimumVertices;
	});
	const pdgOf = (u: Unit) => (c.pdgs[u.file] as readonly Pdg[])[u.function as number];
	stats.units = us.length;
	// sorted by size, so the size bound lets us stop early
	us.sort((x, y) => pdgOf(x).color.length - pdgOf(y).color.length);
	const pairs: ClonePair[] = [];
	for(let i = 0; i < us.length; i++) {
		const f = pdgOf(us[i]);
		for(let j = i + 1; j < us.length; j++) {
			const g = pdgOf(us[j]);
			if(similarSizeBound(f, g) < cfg.threshold) {
				break;
			}
			if(!admissible(c, config, us[i], us[j])) {
				continue;
			}
			stats.comparisons++;
			const r = similarCompare(f, g, cfg.iterations);
			if(r.symmetric >= cfg.threshold) {
				pairs.push({
					algorithm:   CloneAlgorithm.Similar,
					similarity:  r.symmetric,
					containment: [r.fInG, r.gInF],
					a:           fragment(c, us[i].file, us[i].node),
					b:           fragment(c, us[j].file, us[j].node)
				});
			}
		}
	}
	return pairs;
}

const Detectors: Record<CloneAlgorithm, (c: Corpus, config: CloneDetectionConfig, stats: { units: number, comparisons: number }) => ClonePair[]> = {
	[CloneAlgorithm.Baxter]:    detectBaxter,
	[CloneAlgorithm.Gst]:       detectGst,
	[CloneAlgorithm.Winnowing]: detectWinnowing,
	[CloneAlgorithm.Similar]:   detectSimilar
};

/**
 * Runs the configured algorithms on the index. With `against`, only pairs with one fragment from `index` and one
 * from `against` are compared, which is how new code is searched in a corpus of pre-analyzed projects.
 */
export function detectClones(index: CloneIndex, config: CloneDetectionConfig, against?: CloneIndex): CloneDetectionResult {
	const c = corpus(index, against);
	const pairs: ClonePair[] = [];
	const result: { units: Partial<Record<CloneAlgorithm, number>>, comparisons: Partial<Record<CloneAlgorithm, number>>, timing: Partial<Record<CloneAlgorithm, number>> } = { units: {}, comparisons: {}, timing: {} };
	for(const algorithm of new Set(config.algorithms)) {
		const start = performance.now();
		const stats = { units: 0, comparisons: 0 };
		pairs.push(...limitPairs(Detectors[algorithm](c, config, stats), config.maxPairs));
		result.units[algorithm] = stats.units;
		result.comparisons[algorithm] = stats.comparisons;
		result.timing[algorithm] = performance.now() - start;
	}
	return { pairs, stats: { files: c.asts.length, ...result } };
}
