/**
 * The build/write half of the sigdb format: the {@link SigDbBuilder} (accumulate analyzed packages, pool +
 * frequency-reorder the dictionary, emit a {@link SigDb}) and the NDJSON writers (single bundle, shared
 * dictionary, blob-only shards, and the sharded {@link SigDbManifest}). Split out of `../sigdb` so the reader
 * there is not weighed down by the (build-time only) encoder; imports only sibling format/codec modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import {
	DefaultCranBase, MaxDefaultLength, ParamFlag, SigDbExt, SigDbMagic, SigDbSchema,
	type PkgBlob, type Sig, type SigDb, type SigDbFeatures, type SigDbPkgMeta, type SigDbShard, type SigDbTier,
	type SigDep, type SigDependencyInfo, type SigFn, type SigFunctionInfo, type SigParamInfo, type SigVersionInfo
} from './schema';
import { RVersion } from '../../util/r-version';
import { blobTuple } from './decode';
import { contentHash, dictionaryHash, shardHash } from './hash';
import { encodeIndex, type ByteRange, type SigDbIndex, type SigShardIndexWire } from './index-format';
import {
	writeManifest, SigDbManifestMagic, SigDbManifestSchema,
	type SigDbManifest, type SigDbShardRef, type SigDbDictRef
} from './manifest';
import { writeCodecs, zstdSupported, type CodecCompressOptions, type SigDbCodecSpec } from './codec';
import { log } from '../../util/log';

// warn once (build-time) when this Node cannot produce `.zst`, so only the brotli `.br` fallback is written
let zstdSkipLogged = false;
function noteZstdSupport(): void {
	if(!zstdSupported() && !zstdSkipLogged) {
		zstdSkipLogged = true;
		log.warn('sigdb: this Node lacks zstd (node:zlib); writing only the brotli .br fallback (upgrade to Node >= 22.15 for smaller .zst bundles)');
	}
}

/** resolve the effective features (everything defaults to on) */
function resolveFeatures(f: SigDbFeatures | undefined): Required<SigDbFeatures> {
	if(f === undefined) {
		return { signatures: true, callGraphs: true, locations: true, dependencies: true };
	}
	return {
		signatures:   f.signatures   ?? true,
		callGraphs:   f.callGraphs   ?? true,
		locations:    f.locations    ?? true,
		dependencies: f.dependencies ?? true
	};
}

/** first-order delta encoding of an ascending integer list (smaller, more repetitive, compresses better) */
function deltaEncode(sorted: readonly number[]): number[] {
	const out = new Array<number>(sorted.length);
	let prev = 0;
	for(let i = 0; i < sorted.length; i++) {
		out[i] = sorted[i] - prev;
		prev = sorted[i];
	}
	return out;
}

/**
 * Index based string internalization
 */
function internalize<V>(arr: V[], map: Map<string, number>, key: string, value: V): number {
	let i = map.get(key);
	if(i === undefined) {
		i = arr.length;
		arr.push(value);
		map.set(key, i);
	}
	return i;
}

/** the {@link SigDbBuilder}'s in-progress accumulator for one package: its metadata plus every version fed in */
interface RawPkg {
	/** the version marked as the package's latest (what a `current`/`history` tier splits on) */
	latest:    string
	/** whether the latest version is CRAN-archived (affects the source-tarball link) */
	archived:  boolean
	/** download count, used to rank packages into the popularity `top`/`rest` shards */
	downloads: number
	/** whether this is an R-core / base package (recorded in {@link SigDbPkgMeta}, gates the core shard) */
	core:      boolean
	/** every fed-in version keyed by its version string */
	versions:  Map<string, SigVersionInfo>
}

/** per-package metadata handed to {@link SigDbBuilder.addPackage} (everything but `latest` defaults) */
export interface AddPackageOptions {
	readonly latest:     string;
	readonly archived?:  boolean;
	readonly downloads?: number;
	readonly core?:      boolean;
}

/** pack a raw package's metadata, appending the R-core marker only for base packages */
function packMeta(p: Readonly<RawPkg>): SigDbPkgMeta {
	return p.core ? [p.latest, p.archived ? 1 : 0, p.downloads, 1] : [p.latest, p.archived ? 1 : 0, p.downloads];
}

/** one built package blob together with the counts that roll up into the bundle's {@link SigDbContent} */
interface BuiltBlob {
	readonly blob:          PkgBlob;
	readonly versionCount:  number;
	readonly functionCount: number;
}

/** an append-once dedup pool: {@link internalize}s a value under a string key, returning its stable index */
class Pool<V> {
	readonly items: V[] = [];
	private readonly index = new Map<string, number>();
	public intern(key: string, value: V): number {
		return internalize(this.items, this.index, key, value);
	}
}

/** the versions of `p` to keep for `tier`: `current` only the latest, `history` all but it, `full` all (see {@link SigDbTier}) */
function keptVersions(p: Readonly<RawPkg>, tier: SigDbTier): string[] {
	const all = [...p.versions.keys()].sort();
	if(tier === 'full') {
		return all;
	}
	// fall back to the highest by R-version order (not lexical) when the recorded latest is absent
	const latest = p.versions.has(p.latest) ? p.latest : RVersion.highest(all);
	return tier === 'current'
		? (latest !== undefined ? [latest] : [])
		: all.filter(v => v !== latest);
}

/** build one self-contained blob for the given tier + features (functions sorted for determinism) */
function buildBlob(p: Readonly<RawPkg>, strings: StringPool, tier: SigDbTier, feats: Required<SigDbFeatures>): BuiltBlob {
	const sigs = new Pool<Sig>();
	const cgs = new Pool<number[]>();
	const fns = new Pool<SigFn>();
	const deps = new Pool<SigDep[]>();

	const sig = (params: readonly SigParamInfo[]): number => {
		if(!feats.signatures || params.length === 0) {
			return -1;
		}
		const value: Sig = params.map(par => {
			const nameI = strings.str(par.name);
			const flags = (par.forced ? ParamFlag.Forced : 0) | (par.missing ? ParamFlag.Missing : 0);
			if(par.default !== undefined) {
				// cap very long default expressions (e.g. a 7 KB `c(...)` column list): they are unique, so they never
				// dedupe and bloat the dictionary. A truncation marker keeps "has a default" plus a preview. Newlines
				// are flattened so the string is safe as a delimiter in the newline-blob dictionary.
				const d0 = par.default.replace(/[\r\n]+/g, ' ');
				const def = d0.length > MaxDefaultLength ? d0.slice(0, MaxDefaultLength) + '…' : d0;
				return [nameI, flags, strings.str(def)];
			}
			return flags === 0 ? nameI : [nameI, flags];
		});
		return sigs.intern(JSON.stringify(value), value);
	};
	const cg = (callees: readonly string[]): number => {
		if(!feats.callGraphs || callees.length === 0) {
			return -1;
		}
		const idxs = Array.from(new Set(callees), c => strings.str(c)).sort((a, b) => a - b);
		return cgs.intern(idxs.join(','), deltaEncode(idxs));
	};
	const fn = (f: SigFunctionInfo): number => {
		const base: SigFn = [strings.str(f.name), sig(f.params), cg(f.callees), f.props,
			feats.locations && f.file ? strings.str(f.file) : -1, feats.locations ? f.line ?? -1 : -1];
		const rec: SigFn = f.topic && f.topic !== f.name ? [...base, strings.str(f.topic)] : base;
		return fns.intern(rec.join(','), rec);
	};
	const depList = (list: readonly SigDependencyInfo[]): number => {
		// sorted by (type, name) for a canonical, poolable form
		const value: SigDep[] = list
			.toSorted((a, b) => a.type - b.type || a.name.localeCompare(b.name))
			.map(d => d.constraint !== undefined
				? [strings.str(d.name), d.type, strings.str(d.constraint)]
				: [strings.str(d.name), d.type]);
		return deps.intern(JSON.stringify(value), value);
	};

	const versions: Record<string, number[]> = {};
	const depsByVersion: Record<string, number> = {};
	const dates: Record<string, number> = {};
	const noncran: string[] = [];
	let versionCount = 0;
	let functionCount = 0;
	for(const version of keptVersions(p, tier)) {
		const info = p.versions.get(version) as SigVersionInfo;
		const idxs = info.functions
			.toSorted((a, b) => a.name.localeCompare(b.name) || (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? -1) - (b.line ?? -1))
			.map(fn).sort((a, b) => a - b);
		versions[version] = deltaEncode(idxs);
		if(feats.dependencies && info.dependencies && info.dependencies.length > 0) {
			depsByVersion[version] = depList(info.dependencies);
		}
		if(info.date !== undefined && Number.isFinite(info.date)) {
			dates[version] = Math.round(info.date / 86_400_000); // days since the Unix epoch (compact; day precision)
		}
		versionCount++;
		functionCount += info.functions.length;
		if(!info.cran) {
			noncran.push(version);
		}
	}
	const blob: PkgBlob = { sigs: sigs.items, cgs: cgs.items, fns: fns.items, versions, noncran: noncran.length ? noncran : undefined, deps: deps.items, depsByVersion, dates };
	return { blob, versionCount, functionCount };
}

/**
 * Accumulates analyzed functions and serializes a {@link SigDb}. Feed it with {@link addPackage} and
 * {@link addVersion}, then {@link build}. Pooling (dictionary, per-package blobs, whole-package dedup,
 * frequency reordering) happens in {@link build} so the result is deterministic for identical inputs.
 */
export class SigDbBuilder {
	private readonly raw = new Map<string, RawPkg>();

	public addPackage(name: string, opts: AddPackageOptions): void {
		const p = this.raw.get(name);
		if(p) {
			p.latest = opts.latest;
			p.archived = opts.archived ?? p.archived;
			p.downloads = opts.downloads ?? p.downloads;
			p.core = opts.core ?? p.core;
		} else {
			this.raw.set(name, { latest: opts.latest, archived: opts.archived ?? false, downloads: opts.downloads ?? 0, core: opts.core ?? false, versions: new Map() });
			this.namesCache = undefined;   // a new package name invalidates the memoized sorted order
		}
	}

	public addVersion(name: string, version: string, info: SigVersionInfo): void {
		let p = this.raw.get(name);
		if(!p) {
			p = { latest: version, archived: false, downloads: 0, core: false, versions: new Map() };
			this.raw.set(name, p);
			this.namesCache = undefined;   // a new package name invalidates the memoized sorted order
		}
		p.versions.set(version, info);
	}

	/** the package names once, alphabetically -- the stable build order, computed a single time (see {@link selectPackages}) */
	private sortedNames(): readonly string[] {
		return (this.namesCache ??= [...this.raw.keys()].sort());
	}
	private namesCache: readonly string[] | undefined;

	/** the package names to include, in build (sorted) order, honoring the R-core policy and popularity shard */
	private selectPackages(opts: Pick<SigDbBuildOptions, 'topN' | 'shard' | 'core'>): readonly string[] {
		let names: readonly string[] = this.sortedNames();   // filters below reassign to fresh arrays, so no copy needed
		if(opts.core === 'only') {
			names = names.filter(n => (this.raw.get(n) as RawPkg).core);
		} else if(opts.core === 'exclude') {
			names = names.filter(n => !(this.raw.get(n) as RawPkg).core);
		}
		if(opts.topN === undefined || opts.shard === undefined) {
			return names;
		}
		// rank by downloads within the (already core-filtered) selection, then split into top-N / rest
		const ranked = names
			.map(n => [n, (this.raw.get(n) as RawPkg).downloads] as const)
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([n]) => n);
		const top = new Set(ranked.slice(0, opts.topN));
		return names.filter(n => opts.shard === 'top' ? top.has(n) : !top.has(n));
	}

	/**
	 * Build one {@link SigDb} bundle. `tier: 'current'` keeps only each package's latest version (small,
	 * fast to load); `tier: 'full'` keeps every version. `topN` + `shard` further restrict to the most-
	 * downloaded packages (`'top'`) or the remainder (`'rest'`), so a database can be split into several
	 * small shards routed by a {@link SigDbManifest}.
	 */
	public build(opts: SigDbBuildOptions): SigDb {
		const tier: SigDbTier = opts.tier ?? 'full';
		const feats = resolveFeatures(opts.features);
		const strings = new StringPool();
		const blobs: PkgBlob[] = [];
		const blobIdx = new Map<string, number>();
		const pkgs: Record<string, number> = {};
		const pkgMeta: Record<string, SigDbPkgMeta> = {};
		let versionCount = 0;
		let functionCount = 0;
		for(const name of this.selectPackages(opts)) {
			const p = this.raw.get(name) as RawPkg;
			const built = buildBlob(p, strings, tier, feats);
			if(built.versionCount === 0) {
				continue;   // a package with no versions in this tier (e.g. a single-version package under `history`) is not routed
			}
			versionCount += built.versionCount;
			functionCount += built.functionCount;
			const key = JSON.stringify(blobTuple(built.blob));
			pkgs[name] = internalize(blobs, blobIdx, key, built.blob);
			pkgMeta[name] = packMeta(p);
		}
		const dict = (opts.optimizeStrings ?? true) ? optimizeStringOrder(strings.strings, blobs) : strings.strings;
		const cranBase = opts.cranBase && opts.cranBase !== DefaultCranBase ? opts.cranBase : undefined;

		const partial: Omit<SigDb, 'content'> = {
			format:  SigDbMagic, schema:  SigDbSchema, scope:   'signatures',
			...(cranBase ? { cranBase } : {}), strings: dict, blobs, pkgs, meta:    pkgMeta
		};
		return {
			...partial,
			content: {
				version:        Number(opts.date.replace(/-/g, '')),
				date:           opts.date,
				generated:      opts.generated,
				tier,
				...(opts.shard ? { shard: opts.shard, topN: opts.topN } : {}),
				features:       feats,
				packages:       Object.keys(pkgs).length,
				versions:       versionCount,
				functions:      functionCount,
				uniquePackages: blobs.length,
				strings:        dict.length,
				hash:           contentHash(partial)
			}
		};
	}

	/**
	 * Build several shards that all reindex into a **single shared string dictionary** (stored once, not
	 * per shard). All shards' blobs are pooled into one dictionary and frequency-sorted together, so the
	 * dictionary loads once and no strings are duplicated across shards. Package metadata is likewise
	 * collected once. This is the compact, fast-loading counterpart of calling {@link build} per shard.
	 */
	public buildSharded(opts: Omit<SigDbBuildOptions, 'tier' | 'shard' | 'topN'>, specs: readonly ShardSpec[]): ShardedSigDb {
		const feats = resolveFeatures(opts.features);
		const strings = new StringPool(); // SHARED across every shard
		const meta: Record<string, SigDbPkgMeta> = {};
		const shards: SigShard[] = specs.map(spec => {
			const tier: SigDbTier = spec.tier ?? 'full';
			const blobs: PkgBlob[] = [];
			const blobIdx = new Map<string, number>();
			const pkgs: Record<string, number> = {};
			let versions = 0;
			let functions = 0;
			for(const name of this.selectPackages(spec)) {
				const p = this.raw.get(name) as RawPkg;
				const built = buildBlob(p, strings, tier, feats); // interns into the SHARED dictionary
				if(built.versionCount === 0) {
					continue;   // no versions in this tier (e.g. a single-version package under `history`) -> not routed
				}
				versions += built.versionCount;
				functions += built.functionCount;
				pkgs[name] = internalize(blobs, blobIdx, JSON.stringify(blobTuple(built.blob)), built.blob);
				meta[name] = packMeta(p);
			}
			return { id: shardId(spec), tier, shard: spec.shard, topN: spec.topN, core: spec.core, blobs, pkgs, versions, functions, hash: '' };
		});
		// ONE frequency reorder over every shard's blobs, remapping the shared dictionary in place
		const dict = (opts.optimizeStrings ?? true) ? optimizeStringOrder(strings.strings, shards.flatMap(s => s.blobs)) : strings.strings;
		for(const s of shards) {
			s.hash = shardHash(s.blobs, s.pkgs);
		}
		const cranBase = opts.cranBase && opts.cranBase !== DefaultCranBase ? opts.cranBase : undefined;
		return {
			format:    SigDbMagic, schema:    SigDbSchema, scope:     'signatures',
			date:      opts.date, generated: opts.generated, ...(cranBase ? { cranBase } : {}),
			features:  feats, strings:   dict, dictHash:  dictionaryHash(dict), meta, shards
		};
	}
}

/** a shard to build: a temporal tier, optionally restricted to a popularity shard and/or the R-core packages */
export interface ShardSpec { tier?: SigDbTier; shard?: SigDbShard; topN?: number; core?: CorePolicy }
/** the id of a shard, e.g. `base-current`, `current-top` or `full` */
export function shardId(spec: ShardSpec): string {
	const tier = spec.tier ?? 'full';
	if(spec.core === 'only') {
		return `base-${tier}`;
	}
	return spec.shard ? `${tier}-${spec.shard}` : tier;
}

/** one shard produced by {@link SigDbBuilder.buildSharded}: blobs referencing the shared dictionary */
export interface SigShard {
	id:        string;
	tier:      SigDbTier;
	shard?:    SigDbShard;
	topN?:     number;
	core?:     CorePolicy;
	blobs:     PkgBlob[];
	pkgs:      Record<string, number>;
	versions:  number;
	functions: number;
	/** hash over this shard's blobs + pkgs (the dictionary is hashed separately) */
	hash:      string;
}

/** several shards sharing one dictionary + one package-metadata map */
export interface ShardedSigDb {
	format:    typeof SigDbMagic;
	schema:    typeof SigDbSchema;
	scope:     'signatures';
	date:      string;
	generated: number;
	cranBase?: string;
	features:  Required<SigDbFeatures>;
	/** the single shared string dictionary */
	strings:   string[];
	dictHash:  string;
	/** package name to metadata, shared by every shard */
	meta:      Record<string, SigDbPkgMeta>;
	shards:    SigShard[];
}

/** options for {@link SigDbBuilder.build} */
export interface SigDbBuildOptions {
	/** dataset date `YYYY-MM-DD` */
	date:             string;
	/** build timestamp (ms since epoch) */
	generated:        number;
	/** CRAN base url (only stored when non-default) */
	cranBase?:        string;
	/** renumber the string dictionary by frequency for better compression (default: true) */
	optimizeStrings?: boolean;
	/** temporal tier (default `full`) */
	tier?:            SigDbTier;
	/** with {@link SigDbBuildOptions.topN}: include only the top-N most-downloaded packages (`top`) or the rest (`rest`) */
	shard?:           SigDbShard;
	/** download-rank cutoff for {@link SigDbBuildOptions.shard} */
	topN?:            number;
	/** restrict to R-core / base packages (`only`) or exclude them (`exclude`); default: no restriction */
	core?:            CorePolicy;
	/** which information to store (default: everything) */
	features?:        SigDbFeatures;
}

/** how a shard treats R-core / base packages: keep only them, exclude them, or don't care */
export type CorePolicy = 'only' | 'exclude';

/** the global, frequency-orderable string dictionary shared by every package blob */
class StringPool {
	readonly strings: string[] = [];
	private readonly idx = new Map<string, number>();
	str(s: string): number {
		// the dictionary is newline-delimited on disk, so a stored string must never contain one -- otherwise it splits
		// on read and shifts every later index. Flatten defensively here so no field (name, file, topic, ...) can corrupt it.
		const safe = s.includes('\n') || s.includes('\r') ? s.replace(/[\r\n]+/g, ' ') : s;
		return internalize(this.strings, this.idx, safe, safe);
	}
}

/** renumber the dictionary so the most-referenced strings get the smallest indices (a pure bijection) */
function optimizeStringOrder(strings: string[], blobs: PkgBlob[]): string[] {
	const n = strings.length;
	const counts = new Float64Array(n);
	const bump = (i: number): void => {
		if(i >= 0) {
			counts[i]++;
		}
	};
	for(const blob of blobs) {
		for(const s of blob.sigs) {
			for(const p of s) {
				if(typeof p === 'number') {
					bump(p);
				} else {
					bump(p[0]);
					if(p.length === 3) {
						bump(p[2]);
					}
				}
			}
		}
		for(const c of blob.cgs) {
			let prev = 0;
			for(const d of c) {
				prev += d;
				bump(prev);
			}
		}
		for(const f of blob.fns) {
			bump(f[0]);
			bump(f[4]);
			if(f[6] !== undefined) {
				bump(f[6]);
			}
		}
		for(const list of blob.deps) {
			for(const d of list) {
				bump(d[0]);
				if(d.length === 3) {
					bump(d[2]);
				}
			}
		}
	}
	const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => counts[b] - counts[a] || a - b);
	const remap = new Int32Array(n);
	for(let newI = 0; newI < n; newI++) {
		remap[order[newI]] = newI;
	}
	for(const blob of blobs) {
		for(const s of blob.sigs) {
			for(let k = 0; k < s.length; k++) {
				const p = s[k];
				if(typeof p === 'number') {
					s[k] = remap[p];
				} else {
					p[0] = remap[p[0]];
					if(p.length === 3) {
						p[2] = remap[p[2]];
					}
				}
			}
		}
		for(let c = 0; c < blob.cgs.length; c++) {
			const idxs: number[] = [];
			let prev = 0;
			for(const d of blob.cgs[c]) {
				prev += d;
				idxs.push(remap[prev]);
			}
			idxs.sort((a, b) => a - b);
			blob.cgs[c] = deltaEncode(idxs);
		}
		for(const f of blob.fns) {
			f[0] = remap[f[0]];
			if(f[4] >= 0) {
				f[4] = remap[f[4]];
			}
			if(f[6] !== undefined && f[6] >= 0) {
				f[6] = remap[f[6]];
			}
		}
		for(const list of blob.deps) {
			for(const d of list) {
				d[0] = remap[d[0]];
				if(d.length === 3) {
					d[2] = remap[d[2]];
				}
			}
		}
	}
	return order.map(oldI => strings[oldI]);
}


/** flush a batch line once its serialized size reaches roughly this many bytes (keeps lines under the string cap) */
const NdjsonBatchBytes = 8_000_000;

/**
 * Batch the string dictionary into `["d", startIdx, "s1\ns2\n…"]` lines: the strings are joined into ONE
 * newline-delimited blob per line rather than a JSON array of quoted strings. On load this parses as a single
 * string and `split('\n')` -- far faster than `JSON.parse`-ing an array of ~1.4M elements, and a touch smaller
 * Safe because no dictionary string contains a newline (defaults are normalized).
 */
function* dictLines(strings: readonly string[]): Generator<string> {
	let start = 0;
	let parts: string[] = [];
	let bytes = 0;
	const line = (from: number): string => `["d",${from},${JSON.stringify(parts.join('\n'))}]`;
	for(let i = 0; i < strings.length; i++) {
		const s = strings[i];
		if(parts.length > 0 && bytes + s.length + 1 > NdjsonBatchBytes) {
			yield line(start);
			start = i;
			parts = [];
			bytes = 0;
		}
		parts.push(s);
		bytes += s.length + 1;
	}
	yield line(start);
}

/** batch an array into `[tag, startIdx, [...]]` lines that never approach V8's string cap */
function* batchLines(tag: string, arr: readonly unknown[]): Generator<string> {
	let start = 0;
	let parts: string[] = [];
	let bytes = 0;
	const line = (from: number): string => `["${tag}",${from},[${parts.join(',')}]]`;
	for(let i = 0; i < arr.length; i++) {
		const s = JSON.stringify(arr[i]);
		if(parts.length > 0 && bytes + s.length + 1 > NdjsonBatchBytes) {
			yield line(start);
			start = i;
			parts = [];
			bytes = 0;
		}
		parts.push(s);
		bytes += s.length + 1;
	}
	yield line(start);
}

export interface CompressOptions {
	/** zstd compression level (1..22) for the `.zst` output (default 19) */
	level?:         number;
	/** brotli quality for the `.br` output; 11 is smallest but slow, lower is much faster for a small size cost */
	brotliQuality?: number;
	/** brotli window bits (10..30); above 24 enables the non-standard large-window mode (reader must opt in) */
	brotliLgwin?:   number;
}
// large window (30) shaves ~15% off the `.br`; every {@link SigDatabase} read path decodes with
// `BROTLI_DECODER_PARAM_LARGE_WINDOW` enabled, so this is always safe for bundles flowR reads back.
const DefaultBrotliLgwin = 30;

/** codec-appropriate compression options: brotli takes the quality/window, zstd its own level */
function codecOptions(spec: SigDbCodecSpec, compress: CompressOptions): CodecCompressOptions {
	return spec.codec === 'zstd'
		? { level: compress.level }
		: { level: compress.brotliQuality, lgwin: compress.brotliLgwin ?? DefaultBrotliLgwin };
}

/** one compressed sink: the codec transform piped into its `<plain><ext>` file */
interface CodecSink { stream: NodeJS.ReadWriteStream; file: fs.WriteStream }

/**
 * Streams NDJSON lines to `<plain>` plus every codec {@link writeCodecs} yields (`.br` always, `.zst` when this
 * Node supports it) at once, tracking the plain byte offset for seek indexes. A `.br` fallback is thus always
 * produced beside any `.zst`.
 */
class LineWriter {
	private readonly plainOut: fs.WriteStream;
	private readonly sinks:    CodecSink[] = [];
	public byteOff = 0;

	public constructor(plain: string, compress: CompressOptions) {
		noteZstdSupport();
		fs.mkdirSync(path.dirname(path.resolve(plain)), { recursive: true });
		this.plainOut = fs.createWriteStream(plain);
		for(const spec of writeCodecs()) {
			const file = fs.createWriteStream(`${plain}${spec.ext}`);
			const stream = spec.createCompress(codecOptions(spec, compress));
			stream.pipe(file);
			this.sinks.push({ stream, file });
		}
	}

	public async write(text: string): Promise<void> {
		const chunk = text + '\n';
		const back: Promise<unknown>[] = [];
		if(!this.plainOut.write(chunk)) {
			back.push(once(this.plainOut, 'drain'));
		}
		for(const { stream } of this.sinks) {
			if(!stream.write(chunk)) {
				back.push(once(stream, 'drain'));
			}
		}
		if(back.length > 0) {
			await Promise.all(back);
		}
		this.byteOff += Buffer.byteLength(chunk);
	}

	public async close(): Promise<void> {
		this.plainOut.end();
		for(const { stream } of this.sinks) {
			stream.end();
		}
		await Promise.all([once(this.plainOut, 'close'), ...this.sinks.map(s => once(s.file, 'close'))]);
	}
}

/** Write `<outBase>.sigs.ndjson` (+ `.br`, `.zst` when supported, `.idx`) -- a single self-contained bundle (its own dictionary). */
export async function writeSignatureDb(outBase: string, db: SigDb, compress: CompressOptions = {}): Promise<SigDbIndex> {
	const plain = `${outBase}${SigDbExt}`;
	const w = new LineWriter(plain, compress);
	await w.write(JSON.stringify({
		format:  db.format, schema:  db.schema, scope:   db.scope,
		...(db.cranBase ? { cranBase: db.cranBase } : {}), content: db.content
	}));
	const dictStartByte = w.byteOff;
	for(const line of dictLines(db.strings)) {
		await w.write(line);
	}
	const dict: ByteRange = [dictStartByte, w.byteOff - dictStartByte];
	const blobs: ByteRange[] = [];
	for(let i = 0; i < db.blobs.length; i++) {
		const startByte = w.byteOff;
		await w.write(`["b",${i},${JSON.stringify(blobTuple(db.blobs[i]))}]`);
		blobs.push([startByte, w.byteOff - startByte]);
	}
	for(const line of batchLines('m', Object.entries(db.meta))) {
		await w.write(line);
	}
	for(const line of batchLines('p', Object.entries(db.pkgs))) {
		await w.write(line);
	}
	await w.close();
	const index: SigDbIndex = { byteCount: w.byteOff, dict, blobs, pkgs: db.pkgs, meta: db.meta };
	fs.writeFileSync(`${plain}.idx`, JSON.stringify(encodeIndex(index)));
	return index;
}

/** the extension of a standalone shared-dictionary file */
export const SigDbDictExt = '.dict.sigs.ndjson' as const;

/** Write a shared string dictionary to `<outBase>.dict.sigs.ndjson` (+ `.br`/`.zst`). Returns where its lines sit. */
export async function writeDictionary(outBase: string, id: string, strings: readonly string[], compress: CompressOptions = {}): Promise<SigDbDictRef> {
	const plain = `${outBase}${SigDbDictExt}`;
	const w = new LineWriter(plain, compress);
	await w.write(JSON.stringify({ format: 'flowr-sigdb-dict', schema: SigDbSchema, strings: strings.length }));
	const start = w.byteOff;
	for(const line of dictLines(strings)) {
		await w.write(line);
	}
	const range: ByteRange = [start, w.byteOff - start];
	await w.close();
	return { id, path: `${path.basename(outBase)}${SigDbDictExt}`, hash: dictionaryHash(strings), range, byteCount: w.byteOff, strings: strings.length };
}

/** Write one blob-only shard (references a shared dictionary) to `<outBase>.<id>.sigs.ndjson` (+ `.br`/`.zst`). */
export async function writeShardBundle(outBase: string, shard: SigShard, cranBase: string | undefined, compress: CompressOptions = {}): Promise<SigShardIndexWire> {
	const plain = `${outBase}.${shard.id}${SigDbExt}`;
	const w = new LineWriter(plain, compress);
	await w.write(JSON.stringify({
		format:  SigDbMagic, schema:  SigDbSchema, scope:   'signatures', shared:  true,
		...(cranBase ? { cranBase } : {}),
		content: { tier: shard.tier, ...(shard.shard ? { shard: shard.shard, topN: shard.topN } : {}), packages: Object.keys(shard.pkgs).length, versions: shard.versions, functions: shard.functions, hash: shard.hash }
	}));
	const blobs: ByteRange[] = [];
	for(let i = 0; i < shard.blobs.length; i++) {
		const startByte = w.byteOff;
		await w.write(`["b",${i},${JSON.stringify(blobTuple(shard.blobs[i]))}]`);
		blobs.push([startByte, w.byteOff - startByte]);
	}
	for(const line of batchLines('p', Object.entries(shard.pkgs))) {
		await w.write(line);
	}
	await w.close();
	return { n: w.byteOff, b: blobs, p: shard.pkgs };
}

/** options for {@link writeShardedDatabase} */
export interface ShardedWriteOptions extends CompressOptions {
	/** assemble a clean copy-into-flowR folder holding just the compressed shards, the dictionary and the manifest */
	pack?:    string;
	/** invoked after each shard file is written (for progress logging) */
	onShard?: (shard: SigShard, ref: SigDbShardRef) => void;
}

/**
 * Write a {@link ShardedSigDb}: one shared dictionary file, one blob-only file per shard, and a
 * {@link SigDbManifest} that embeds each shard's index and references the shared dictionary by id. Every
 * shard reindexes into that single dictionary (stored once, not per shard). A reader needs only the compressed
 * files plus the manifest -- no `.idx` sidecars. With `pack`, also assembles a clean copy-into-flowR folder.
 */
export async function writeShardedDatabase(outBase: string, db: ShardedSigDb, manifestFile: string, opts: ShardedWriteOptions = {}): Promise<SigDbManifest> {
	const compress: CompressOptions = { level: opts.level, brotliQuality: opts.brotliQuality, brotliLgwin: opts.brotliLgwin };
	const exts = writeCodecs().map(c => c.ext);   // every compressed variant produced (`.br` always, `.zst` when supported)
	const base = path.basename(outBase);
	const dictRef = await writeDictionary(outBase, 'shared', db.strings, compress);
	const shardRefs: SigDbShardRef[] = [];
	for(const s of db.shards) {
		const idx = await writeShardBundle(outBase, s, db.cranBase, compress);
		const ref: SigDbShardRef = {
			id:       s.id, tier:     s.tier, ...(s.shard ? { shard: s.shard, topN: s.topN } : {}),
			path:     `${base}.${s.id}${SigDbExt}`, hash:     s.hash,
			packages: Object.keys(s.pkgs).length, versions: s.versions, dict:     dictRef.id, idx
		};
		shardRefs.push(ref);
		opts.onShard?.(s, ref);
	}
	const manifest: SigDbManifest = {
		format:    SigDbManifestMagic, schema:    SigDbManifestSchema, date:      db.date, generated: db.generated,
		...(db.cranBase ? { cranBase: db.cranBase } : {}), meta:      db.meta, dicts:     [dictRef], shards:    shardRefs
	};
	writeManifest(manifestFile, manifest);
	if(opts.pack) {
		// a self-contained folder to copy into flowR: every compressed variant of the dictionary + shards + the (index-embedding) manifest
		fs.mkdirSync(opts.pack, { recursive: true });
		for(const ext of exts) {
			fs.copyFileSync(`${outBase}${SigDbDictExt}${ext}`, path.join(opts.pack, `${dictRef.path}${ext}`));
			for(const ref of shardRefs) {
				fs.copyFileSync(`${outBase}.${ref.id}${SigDbExt}${ext}`, path.join(opts.pack, `${ref.path}${ext}`));
			}
		}
		writeManifest(path.join(opts.pack, `${base}.manifest.json`), manifest);
	}
	return manifest;
}
