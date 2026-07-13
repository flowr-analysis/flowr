import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { once } from 'events';
import readline from 'readline';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';
import type { SemVer } from 'semver';
import { RVersion } from '../../../util/r-version';

export const DefaultCranBase = 'https://cran.r-project.org/src/contrib/';

/** a definition location surfaced when the database carries them (per-identifier, latest version) */
export interface SigDefinitionLocation { file: string, line: number }

/** the resolved identifiers of one package version (the export view every reader can answer) */
export interface LibraryExports {
	version:    string;
	exported:   string[];
	/** defined-but-not-exported identifiers (only available when internal names are stored) */
	internal:   string[];
	deprecated: string[];
	cran:       boolean;
	cranUrl?:   string;
	/** definition location per identifier, if the database carries them (latest version) */
	locations?: ReadonlyMap<string, SigDefinitionLocation>;
}

/** Reconstruct the CRAN source blob link; the newest non-archived version lives under `src/contrib`, every other under `Archive`. */
export function cranBlobUrl(cranBase: string, pkg: string, version: string, opts: { latest: string, archived: boolean, cran: boolean }): string | undefined {
	if(!opts.cran) {
		return undefined;
	}
	const base = cranBase.endsWith('/') ? cranBase : cranBase + '/';
	return version === opts.latest && !opts.archived
		? `${base}${pkg}_${version}.tar.gz`
		: `${base}Archive/${pkg}/${pkg}_${version}.tar.gz`;
}

/**
 * Portable, streaming, non-cryptographic 64-bit hash (cyrb53), emitted as 16 hex chars. Feed it in
 * chunks with {@link update} (so callers can hash data larger than a single string) and read the result
 * with {@link digest}. Used for content/update detection across the database; browser-safe (no `crypto`).
 */
export class Hash53 {
	private h1 = 0xdeadbeef;
	private h2 = 0x41c6ce57;

	public update(str: string): this {
		for(let i = 0; i < str.length; i++) {
			const ch = str.charCodeAt(i);
			this.h1 = Math.imul(this.h1 ^ ch, 2654435761);
			this.h2 = Math.imul(this.h2 ^ ch, 1597334677);
		}
		return this;
	}

	public digest(): string {
		const h1 = Math.imul(this.h1 ^ (this.h1 >>> 16), 2246822507) ^ Math.imul(this.h2 ^ (this.h2 >>> 13), 3266489909);
		const h2 = Math.imul(this.h2 ^ (this.h2 >>> 16), 2246822507) ^ Math.imul(this.h1 ^ (this.h1 >>> 13), 3266489909);
		return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
	}
}

/** portable non-cryptographic 64-bit hash (cyrb53), hex, for update detection */
export function hash53(str: string): string {
	return new Hash53().update(str).digest();
}

/**
 * An R package version parsed into a comparable {@link SemVer} while retaining its original string as
 * `.str` (via flowR's {@link RVersion.parse}). This is the informative version type the reader returns:
 * consumers get correct version *ordering* (e.g. R `2.14.0` &gt; `2.9.0`, which string comparison gets
 * wrong) plus the exact original text. Pass either this or a plain version string wherever a version is
 * accepted ({@link RPackageVersionLike}).
 */
export type RPackageVersion = SemVer & { str: string };
/** either a parsed {@link RPackageVersion} or the raw version string it came from */
export type RPackageVersionLike = string | RPackageVersion;

/** the raw version key (dictionary/blob keys are the original strings) for either form of version */
function versionKey(v: RPackageVersionLike | undefined): string | undefined {
	return v === undefined ? undefined : typeof v === 'string' ? v : v.str;
}
/** parse a stored version string into the informative {@link RPackageVersion} (never throws — a truly un-coercible version sorts as `0.0.0` but keeps its original `.str`) */
export function toRVersion(version: string): RPackageVersion {
	const parsed = RVersion.parse(version);
	if(parsed !== undefined) {
		return parsed;
	}
	const fallback = RVersion.parse('0.0.0') as SemVer & { str: string };   // `0.0.0` always parses
	fallback.str = version;
	return fallback;
}

/*
 * Reader/writer + builder for the `flowr-sigdb` database (schema 4): flowR's sole package database.
 * For every package/version/function it carries the signature (parameters, forced/optional,
 * defaults), the call graph, and the version's declared dependencies (Depends/Imports/… with their
 * version qualifiers), and answers the {@link LibraryExports} export view (exports = the exported
 * functions, internal = the rest, deprecated, per-version definition locations, cran/cranUrl) that
 * `library()`/`use()` resolution consumes. Which of these are stored is selectable via
 * {@link SigDbFeatures} (default: all).
 *
 * Two goals shape the layout:
 *  - **Compact.** One global frequency-ordered string dictionary holds every repeated string once;
 *    everything else references it by integer. Within a package, identical signatures, call graphs and
 *    whole function records are pooled across versions, sorted index lists are delta-encoded, and
 *    identical packages are deduplicated to a single blob.
 *  - **Fast, partial loading.** The on-disk form is NDJSON — line 1 a header, then the dictionary, then
 *    one self-contained blob per package — and a sidecar `.idx` records the byte offset of the
 *    dictionary and of every package. {@link SigDatabase} loads the dictionary once (~hundreds of ms
 *    for all of CRAN) and then seeks straight to just the packages asked for (sub-millisecond each),
 *    never materializing the whole (multi-hundred-MB) file.
 *
 * {@link SigDbBuilder} writes (fed the analyzed functions, e.g. by crawlr), {@link SigDatabase} reads.
 */

export const SigDbMagic = 'flowr-sigdb';
export const SigDbSchema = 4;
/**
 * Parameter default expressions longer than this are stored truncated (with a `…` marker): flowR only needs a
 * short lexeme preview of a default, not the whole expression, so a small cap keeps the dictionary compact.
 */
export const MaxDefaultLength = 10;
/** file extension of the (uncompressed) bundle */
export const SigDbExt = '.sigs.ndjson';

/** function-level boolean properties, packed into {@link SigFn}'s bitfield */
export const enum FnProp {
	Exported         = 1,
	HigherOrder      = 2,
	Recursive        = 4,
	CallsDeprecated  = 8,
	CanThrow         = 16,
	Deprecated       = 32,
	CallsInternal    = 64,
	NonDeterministic = 128
}

/** the {@link FnProp} bits in order, with their names (for decoding) */
export const FnPropNames: readonly [FnProp, string][] = [
	[FnProp.Exported, 'exported'], [FnProp.HigherOrder, 'higher-order'], [FnProp.Recursive, 'recursive'],
	[FnProp.CallsDeprecated, 'calls-deprecated'], [FnProp.CanThrow, 'can-throw'], [FnProp.Deprecated, 'deprecated'],
	[FnProp.CallsInternal, 'calls-internal'], [FnProp.NonDeterministic, 'non-deterministic']
];

/** parameter flags, packed into {@link SigParam}'s flag int */
export const enum ParamFlag {
	/** forced: the argument is always evaluated (crawlr `always-read`) */
	Forced  = 1,
	/** the argument has no default value (crawlr `missing`) */
	Missing = 2
}

/**
 * One parameter of a signature (position implied by array order): just `nameIdx`, or `[nameIdx, flags]`,
 * or `[nameIdx, flags, defaultIdx]`. All indices point into the global string dictionary.
 */
export type SigParam = number | [nameIdx: number, flags: number] | [nameIdx: number, flags: number, defaultIdx: number];
/** a full signature: the ordered parameter list */
export type Sig = SigParam[];
/** one function record `[nameIdx, sigIdx, cgIdx, propBits, fileIdx, line]` (`sigIdx`/`cgIdx`/`fileIdx` are -1 when absent) */
export type SigFn = [nameIdx: number, sigIdx: number, cgIdx: number, propBits: number, fileIdx: number, line: number];

/** the kind of a package dependency (mirrors the DESCRIPTION fields) */
export const enum DepType { Depends = 0, Imports = 1, LinkingTo = 2, Suggests = 3, Enhances = 4 }
/** the {@link DepType} values in order, with their names (for decoding) */
export const DepTypeNames = ['depends', 'imports', 'linkingTo', 'suggests', 'enhances'] as const;
export type DepTypeName = typeof DepTypeNames[number];

/** one dependency: `[nameIdx, type]` or `[nameIdx, type, constraintIdx]` (indices into the global dictionary) */
export type SigDep = [nameIdx: number, type: DepType] | [nameIdx: number, type: DepType, constraintIdx: number];

/**
 * A self-contained package. A `versions[ver]` entry is a **delta-encoded** ascending list of indices into
 * {@link PkgBlob.fns} (cumulative-sum to decode); its long runs of `1` just mean a version's functions sit in
 * consecutive pool slots, which brotli collapses on disk. See {@link PkgBlobTuple} for the on-disk order.
 */
export interface PkgBlob {
	sigs:          Sig[];
	cgs:           number[][];
	fns:           SigFn[];
	/** version name to a delta-encoded ascending list of indices into {@link PkgBlob.fns} */
	versions:      Record<string, number[]>;
	/** the subset of {@link PkgBlob.versions} that are not from CRAN (usually empty) */
	noncran:       string[];
	/** pool of unique dependency lists (shared across a package's versions) */
	deps:          SigDep[][];
	/** version name to an index into {@link PkgBlob.deps} (absent when the version declares no dependencies) */
	depsByVersion: Record<string, number>;
	/** version name to its release date as **days since the Unix epoch** (absent when the date is unknown) */
	dates:         Record<string, number>;
}
/** on-disk tuple form of a {@link PkgBlob}: `[sigs, cgs, fns, versions, noncran, deps, depsByVersion, dates]` */
type PkgBlobTuple = [Sig[], number[][], SigFn[], Record<string, number[]>, string[], SigDep[][], Record<string, number>, Record<string, number>?];

/** per-package metadata `[latestVersion, archived (0|1), downloads]` (kept out of the deduped blob) */
/**
 * Per-package metadata. The optional 4th element marks an **R-core / base package** (`base`, `stats`,
 * `parallel`, the historical `mva`/`nls`/…): for these the version keys are the R releases during which
 * the package shipped with core R, so the set of versions is exactly the R versions it was part of core.
 */
export type SigDbPkgMeta = [latest: string, archived: number, downloads: number, core?: number];

/**
 * Temporal tier of a bundle's packages:
 * - `current` — only each package's latest version.
 * - `full`    — every version (self-contained history).
 * - `history` — every version EXCEPT the latest. This is the delta a `current` bundle already carries, so a
 *   `history` bundle mounts beside a `current`/slim one to add the older versions with **zero duplication**
 *   (a single-version package has no non-latest version and is dropped entirely, not routed empty).
 *   Specific-version `lookup` routes correctly across the two; whole-history helpers ({@link SigDatabaseSet.versions},
 *   {@link SigDatabaseSet.releaseDates}, {@link SigDatabaseSet.latestVersion}) read a single shard, so with a
 *   `history` bundle they see the older versions but not the latest — mount a `full` bundle if you need both in one.
 */
export type SigDbTier = 'full' | 'current' | 'history';
/** popularity shard: `top` keeps the most-downloaded packages, `rest` the remainder (undefined = all) */
export type SigDbShard = 'top' | 'rest';

export interface SigDbContent {
	version:        number;
	date:           string;
	generated:      number;
	/** temporal tier of this bundle */
	tier:           SigDbTier;
	/** popularity shard, when the bundle was split by download rank */
	shard?:         SigDbShard;
	/** the download-rank cutoff used for {@link SigDbContent.shard} */
	topN?:          number;
	/** which information this bundle stores */
	features?:      Required<SigDbFeatures>;
	packages:       number;
	versions:       number;
	functions:      number;
	uniquePackages: number;
	strings:        number;
	hash:           string;
}

export interface SigDb {
	format:    typeof SigDbMagic;
	schema:    typeof SigDbSchema;
	scope:     'signatures';
	content:   SigDbContent;
	cranBase?: string;
	/** global string dictionary */
	strings:   string[];
	/** unique per-package blobs */
	blobs:     PkgBlob[];
	/** package name to its index into {@link SigDb.blobs} */
	pkgs:      Record<string, number>;
	/** package name to its {@link SigDbPkgMeta} */
	meta:      Record<string, SigDbPkgMeta>;
}

/* -------------------------------------------------------------------------------------------------
 * Builder input: what an analyser (e.g. crawlr) feeds in per function/version/package.
 * ---------------------------------------------------------------------------------------------- */

export interface SigParamInfo {
	name:     string;
	forced?:  boolean;
	/** the argument has no default value */
	missing?: boolean;
	default?: string;
}
export interface SigFunctionInfo {
	name:    string;
	/** bitfield of {@link FnProp} (must set {@link FnProp.Exported} for exported functions) */
	props:   number;
	params:  SigParamInfo[];
	/** named callees (order/duplication irrelevant; deduped + sorted internally) */
	callees: readonly string[];
	file?:   string;
	line?:   number;
}
/** one declared package dependency, e.g. `{ name: 'testthat', type: Suggests, constraint: '>= 2.1.0' }` */
export interface SigDependencyInfo {
	name:        string;
	type:        DepType;
	/** the version qualifier as written in DESCRIPTION, e.g. `>= 3.0.0` (absent = any version) */
	constraint?: string;
}
export interface SigVersionInfo {
	cran:          boolean;
	functions:     readonly SigFunctionInfo[];
	/** declared dependencies of this version (Depends/Imports/LinkingTo/Suggests/Enhances) */
	dependencies?: readonly SigDependencyInfo[];
	/** release date as milliseconds since the Unix epoch (stored at day granularity, used to find the newest release) */
	date?:         number;
}

/**
 * Which information to store in a bundle (default: everything). Turning a feature off shrinks the
 * database — e.g. an exports-and-dependencies-only bundle omits the (largest) call graphs and signatures.
 * The export view (exported/internal/deprecated) is always available.
 */
export interface SigDbFeatures {
	/** parameter lists (names, forced/optional, defaults) — default true */
	signatures?:   boolean;
	/** per-function call graphs (named callees) — default true */
	callGraphs?:   boolean;
	/** definition locations (file + line) — default true */
	locations?:    boolean;
	/** per-version declared dependencies — default true */
	dependencies?: boolean;
}

/** resolve the effective features (everything defaults to on) */
function resolveFeatures(f: SigDbFeatures | undefined): Required<SigDbFeatures> {
	return {
		signatures:   f?.signatures   ?? true,
		callGraphs:   f?.callGraphs   ?? true,
		locations:    f?.locations    ?? true,
		dependencies: f?.dependencies ?? true
	};
}

/* -------------------------------------------------------------------------------------------------
 * Building.
 * ---------------------------------------------------------------------------------------------- */

/** first-order delta encoding of an ascending integer list (smaller, more repetitive, compresses better) */
function deltaEncode(sorted: number[]): number[] {
	const out = new Array<number>(sorted.length);
	let prev = 0;
	for(let i = 0; i < sorted.length; i++) {
		out[i] = sorted[i] - prev;
		prev = sorted[i];
	}
	return out;
}

function intern<V>(arr: V[], map: Map<string, number>, key: string, value: V): number {
	let i = map.get(key);
	if(i === undefined) {
		i = arr.length;
		arr.push(value);
		map.set(key, i);
	}
	return i;
}

interface RawPkg { latest: string, archived: boolean, downloads: number, core: boolean, versions: Map<string, SigVersionInfo> }

/** pack a raw package's metadata, appending the R-core marker only for base packages (kept absent otherwise) */
function packMeta(p: RawPkg): SigDbPkgMeta {
	return p.core ? [p.latest, p.archived ? 1 : 0, p.downloads, 1] : [p.latest, p.archived ? 1 : 0, p.downloads];
}

/**
 * Accumulates analyzed functions and serializes a {@link SigDb}. Feed it with {@link addPackage} and
 * {@link addVersion}, then {@link build}. Pooling (dictionary, per-package blobs, whole-package dedup,
 * frequency reordering) happens in {@link build} so the result is deterministic for identical inputs.
 */
export class SigDbBuilder {
	private readonly raw = new Map<string, RawPkg>();

	public addPackage(name: string, opts: { latest: string, archived?: boolean, downloads?: number, core?: boolean }): void {
		const p = this.raw.get(name);
		if(p) {
			p.latest = opts.latest;
			p.archived = opts.archived ?? p.archived;
			p.downloads = opts.downloads ?? p.downloads;
			p.core = opts.core ?? p.core;
		} else {
			this.raw.set(name, { latest: opts.latest, archived: opts.archived ?? false, downloads: opts.downloads ?? 0, core: opts.core ?? false, versions: new Map() });
		}
	}

	public addVersion(name: string, version: string, info: SigVersionInfo): void {
		let p = this.raw.get(name);
		if(!p) {
			p = { latest: version, archived: false, downloads: 0, core: false, versions: new Map() };
			this.raw.set(name, p);
		}
		p.versions.set(version, info);
	}

	/** build one self-contained blob for the given tier + features (functions sorted for determinism) */
	private buildBlob(p: RawPkg, strings: StringPool, tier: SigDbTier, feats: Required<SigDbFeatures>): { blob: PkgBlob, versionCount: number, functionCount: number } {
		const sigs: Sig[] = [];
		const sigIdx = new Map<string, number>();
		const cgs: number[][] = [];
		const cgIdx = new Map<string, number>();
		const fns: SigFn[] = [];
		const fnIdx = new Map<string, number>();
		const deps: SigDep[][] = [];
		const depIdx = new Map<string, number>();

		const sig = (params: readonly SigParamInfo[]): number => {
			if(!feats.signatures || params.length === 0) {
				return -1;
			}
			const value: Sig = params.map(par => {
				const nameI = strings.str(par.name);
				const flags = (par.forced ? ParamFlag.Forced : 0) | (par.missing ? ParamFlag.Missing : 0);
				if(par.default !== undefined) {
					// cap very long default expressions (e.g. a 7 KB `c(...)` column list): they are unique, so they
					// never dedupe and bloat the dictionary. A truncation marker keeps "has a default" plus a preview.
					// Newlines are flattened so the string is safe as a delimiter in the newline-blob dictionary.
					const d0 = par.default.replace(/[\r\n]+/g, ' ');
					const def = d0.length > MaxDefaultLength ? d0.slice(0, MaxDefaultLength) + '…' : d0;
					return [nameI, flags, strings.str(def)];
				}
				return flags === 0 ? nameI : [nameI, flags];
			});
			return intern(sigs, sigIdx, JSON.stringify(value), value);
		};
		const cg = (callees: readonly string[]): number => {
			if(!feats.callGraphs || callees.length === 0) {
				return -1;
			}
			const idxs = [...new Set(callees)].map(c => strings.str(c)).sort((a, b) => a - b);
			return intern(cgs, cgIdx, idxs.join(','), deltaEncode(idxs));
		};
		const fn = (f: SigFunctionInfo): number => {
			const rec: SigFn = [strings.str(f.name), sig(f.params), cg(f.callees), f.props,
				feats.locations && f.file ? strings.str(f.file) : -1, feats.locations ? f.line ?? -1 : -1];
			return intern(fns, fnIdx, rec.join(','), rec);
		};
		const depList = (list: readonly SigDependencyInfo[]): number => {
			// sorted by (type, name) for a canonical, poolable form
			const value: SigDep[] = [...list]
				.sort((a, b) => a.type - b.type || a.name.localeCompare(b.name))
				.map(d => d.constraint !== undefined
					? [strings.str(d.name), d.type, strings.str(d.constraint)]
					: [strings.str(d.name), d.type]);
			return intern(deps, depIdx, JSON.stringify(value), value);
		};

		// `current` keeps only the latest version; `full` keeps every version; `history` keeps every version
		// EXCEPT the latest (the delta a `current` bundle already carries -- see {@link SigDbTier})
		let keep = [...p.versions.keys()].sort();
		if(tier === 'current' || tier === 'history') {
			// fall back to the highest by R-version order (not lexical) when the recorded latest is absent
			const latest = p.versions.has(p.latest) ? p.latest : highestVersion(keep);
			keep = tier === 'current'
				? (latest !== undefined ? [latest] : [])
				: keep.filter(v => v !== latest);
		}

		const versions: Record<string, number[]> = {};
		const depsByVersion: Record<string, number> = {};
		const dates: Record<string, number> = {};
		const noncran: string[] = [];
		let versionCount = 0;
		let functionCount = 0;
		for(const version of keep) {
			const info = p.versions.get(version) as SigVersionInfo;
			const sorted = [...info.functions].sort((a, b) =>
				a.name.localeCompare(b.name) || (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? -1) - (b.line ?? -1));
			const idxs = sorted.map(fn).sort((a, b) => a - b);
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
		return { blob: { sigs, cgs, fns, versions, noncran, deps, depsByVersion, dates }, versionCount, functionCount };
	}

	/** the package names to include, in build (sorted) order, honouring the R-core policy and popularity shard */
	private selectPackages(opts: Pick<SigDbBuildOptions, 'topN' | 'shard' | 'core'>): string[] {
		let names = [...this.raw.keys()].sort();
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
			const built = this.buildBlob(p, strings, tier, feats);
			if(built.versionCount === 0) {
				continue;   // a package with no versions in this tier (e.g. a single-version package under `history`) is not routed
			}
			versionCount += built.versionCount;
			functionCount += built.functionCount;
			const key = JSON.stringify(blobTuple(built.blob));
			pkgs[name] = intern(blobs, blobIdx, key, built.blob);
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
				const built = this.buildBlob(p, strings, tier, feats); // interns into the SHARED dictionary
				if(built.versionCount === 0) {
					continue;   // no versions in this tier (e.g. a single-version package under `history`) -> not routed
				}
				versions += built.versionCount;
				functions += built.functionCount;
				pkgs[name] = intern(blobs, blobIdx, JSON.stringify(blobTuple(built.blob)), built.blob);
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
		return intern(this.strings, this.idx, s, s);
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

const blobTuple = (b: PkgBlob): PkgBlobTuple => Object.keys(b.dates).length > 0
	? [b.sigs, b.cgs, b.fns, b.versions, b.noncran, b.deps, b.depsByVersion, b.dates]
	: [b.sigs, b.cgs, b.fns, b.versions, b.noncran, b.deps, b.depsByVersion];
function tupleToBlob(t: PkgBlobTuple): PkgBlob {
	return { sigs: t[0], cgs: t[1], fns: t[2], versions: t[3], noncran: t[4] ?? [], deps: t[5] ?? [], depsByVersion: t[6] ?? {}, dates: t[7] ?? {} };
}

/* -------------------------------------------------------------------------------------------------
 * Content hash (streamed; independent of container/metadata).
 * ---------------------------------------------------------------------------------------------- */

function* hashChunks(db: Pick<SigDb, 'strings' | 'blobs' | 'pkgs' | 'meta'>): Generator<string> {
	for(const s of db.strings) {
		yield JSON.stringify(s);
	}
	for(const b of db.blobs) {
		yield JSON.stringify(blobTuple(b));
	}
	yield JSON.stringify(db.pkgs);
	yield JSON.stringify(db.meta);
}
/** run a Hash53 over a stream of chunks (each null-terminated so boundaries can't collide) */
function hashOf(chunks: Iterable<string>): string {
	const h = new Hash53();
	for(const chunk of chunks) {
		h.update(chunk).update('\x00');
	}
	return h.digest();
}
function contentHash(db: Omit<SigDb, 'content'>): string {
	return hashOf(hashChunks(db));
}
/** stable hash of a shared dictionary */
export function dictionaryHash(strings: readonly string[]): string {
	return hashOf((function*() {
		for(const s of strings) {
			yield JSON.stringify(s);
		}
	})());
}
/** stable hash of one shard's data (its blobs + pkgs map; the dictionary is hashed separately) */
export function shardHash(blobs: readonly PkgBlob[], pkgs: Record<string, number>): string {
	return hashOf((function*() {
		for(const b of blobs) {
			yield JSON.stringify(blobTuple(b));
		}
		yield JSON.stringify(pkgs);
	})());
}

/* -------------------------------------------------------------------------------------------------
 * Serialization: NDJSON with short tags — "d" dictionary, "b" blob, "m" meta, "p" pkgs.
 * ---------------------------------------------------------------------------------------------- */

/** flush a batch line once its serialized size reaches roughly this many bytes (keeps lines under the string cap) */
const NdjsonBatchBytes = 8_000_000;

/**
 * Batch the string dictionary into `["d", startIdx, "s1\ns2\n…"]` lines: the strings are joined into ONE
 * newline-delimited blob per line rather than a JSON array of quoted strings. On load this parses as a single
 * string and `split('\n')` -- far faster than `JSON.parse`-ing an array of ~1.4M elements, and a touch smaller
 * (no per-string quotes/commas). Safe because no dictionary string contains a newline (defaults are normalized).
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

/** decode a `d` line's payload (the new newline-blob form, or the legacy `string[]` form) into a batch of strings */
function decodeDictBatch(payload: string | string[]): string[] {
	return typeof payload === 'string' ? payload.split('\n') : payload;
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

/** a byte range `[startByte, bytes]` in the plain `.ndjson` */
export type ByteRange = [startByte: number, bytes: number];

/**
 * Everything a reader needs to seek into a plain `.ndjson`: the dictionary's byte range, each package
 * blob's byte range, the package to blob-index map, and per-package metadata. (Line numbers and section
 * bookkeeping the writer used are intentionally not kept — they bloat the index and are never read.)
 */
export interface SigDbIndex {
	/** total byte size of the plain `.ndjson` */
	byteCount: number;
	/** byte range of the string dictionary section */
	dict:      ByteRange;
	/** per package-blob byte range (indexed by blob index) */
	blobs:     ByteRange[];
	/** package name to blob index */
	pkgs:      Record<string, number>;
	/** package name to metadata */
	meta:      Record<string, SigDbPkgMeta>;
}

/** the on-disk (compact) form of a {@link SigDbIndex}: short keys, `meta` optional (hoisted into a manifest) */
export interface SigDbIndexWire { n: number; d: ByteRange; b: ByteRange[]; p: Record<string, number>; m?: Record<string, SigDbPkgMeta> }

/** encode an index to its compact on-disk form; omit `meta` when it is hoisted elsewhere (a manifest) */
export function encodeIndex(i: SigDbIndex, withMeta = true): SigDbIndexWire {
	return { n: i.byteCount, d: i.dict, b: i.blobs, p: i.pkgs, ...(withMeta ? { m: i.meta } : {}) };
}
/** decode a compact index; `meta` falls back to a hoisted map, and `dict` to empty (a blob-only shard) */
export function decodeIndex(w: SigDbIndexWire | SigShardIndexWire, meta?: Record<string, SigDbPkgMeta>): SigDbIndex {
	const full = w as SigDbIndexWire;
	return { byteCount: w.n, dict: full.d ?? [0, 0], blobs: w.b, pkgs: w.p, meta: full.m ?? meta ?? {} };
}

export interface CompressOptions {
	/** brotli quality for the `.br` output; 11 is smallest but slow, lower is much faster for a small size cost */
	brotliQuality?: number;
	/** brotli window bits (10..30); above 24 enables the non-standard large-window mode (reader must opt in) */
	brotliLgwin?:   number;
}
// large window (30) shaves ~15% off the `.br`; every {@link SigDatabase} read path decodes with
// `BROTLI_DECODER_PARAM_LARGE_WINDOW` enabled, so this is always safe for bundles flowR reads back.
const DefaultCompress: Required<CompressOptions> = { brotliQuality: 11, brotliLgwin: 30 };

/** streams NDJSON lines to `<plain>` + `.gz` + `.br` at once, tracking the plain byte offset for seek indexes */
class LineWriter {
	private readonly plainOut: fs.WriteStream;
	private readonly gzFile:   fs.WriteStream;
	private readonly brFile:   fs.WriteStream;
	private readonly gzip:     zlib.Gzip;
	private readonly brot:     zlib.BrotliCompress;
	public byteOff = 0;

	public constructor(plain: string, compress: CompressOptions) {
		const lgwin = compress.brotliLgwin ?? DefaultCompress.brotliLgwin;
		fs.mkdirSync(path.dirname(path.resolve(plain)), { recursive: true });
		this.plainOut = fs.createWriteStream(plain);
		this.gzFile = fs.createWriteStream(`${plain}.gz`);
		this.brFile = fs.createWriteStream(`${plain}.br`);
		this.gzip = zlib.createGzip({ level: 9 });
		this.brot = zlib.createBrotliCompress({ params: {
			[zlib.constants.BROTLI_PARAM_QUALITY]:      compress.brotliQuality ?? DefaultCompress.brotliQuality,
			[zlib.constants.BROTLI_PARAM_LGWIN]:        lgwin,
			[zlib.constants.BROTLI_PARAM_LARGE_WINDOW]: lgwin > 24 ? 1 : 0
		} });
		this.gzip.pipe(this.gzFile);
		this.brot.pipe(this.brFile);
	}

	public async write(text: string): Promise<void> {
		const chunk = text + '\n';
		const back: Promise<unknown>[] = [];
		if(!this.plainOut.write(chunk)) {
			back.push(once(this.plainOut, 'drain'));
		}
		if(!this.gzip.write(chunk)) {
			back.push(once(this.gzip, 'drain'));
		}
		if(!this.brot.write(chunk)) {
			back.push(once(this.brot, 'drain'));
		}
		if(back.length > 0) {
			await Promise.all(back);
		}
		this.byteOff += Buffer.byteLength(chunk);
	}

	public async close(): Promise<void> {
		this.plainOut.end();
		this.gzip.end();
		this.brot.end();
		await Promise.all([once(this.plainOut, 'close'), once(this.gzFile, 'close'), once(this.brFile, 'close')]);
	}
}

/** Write `<outBase>.sigs.ndjson` (+ `.gz`, `.br`, `.idx`) — a single self-contained bundle (its own dictionary). */
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

/** a shared dictionary written as its own bundle */
export interface SigDbDictRef { id: string; path: string; hash: string; range: ByteRange; byteCount: number; strings: number }

/** Write a shared string dictionary to `<outBase>.dict.sigs.ndjson` (+ `.gz`/`.br`). Returns where its lines sit. */
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

/** the compact index of a blob-only shard (no dictionary of its own; references a shared one) */
export interface SigShardIndexWire { n: number; b: ByteRange[]; p: Record<string, number> }

/** Write one blob-only shard (references a shared dictionary) to `<outBase>.<id>.sigs.ndjson` (+ `.gz`/`.br`). */
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
	/** assemble a clean copy-into-flowR folder holding just the `.br` shards, the `.br` dictionary and the manifest */
	pack?:    string;
	/** invoked after each shard file is written (for progress logging) */
	onShard?: (shard: SigShard, ref: SigDbShardRef) => void;
}

/**
 * Write a {@link ShardedSigDb}: one shared dictionary file, one blob-only file per shard, and a
 * {@link SigDbManifest} that embeds each shard's index and references the shared dictionary by id. Every
 * shard reindexes into that single dictionary (stored once, not per shard). A reader needs only the `.br`
 * files plus the manifest — no `.idx` sidecars. With `pack`, also assembles a clean copy-into-flowR folder.
 */
export async function writeShardedDatabase(outBase: string, db: ShardedSigDb, manifestFile: string, opts: ShardedWriteOptions = {}): Promise<SigDbManifest> {
	const compress: CompressOptions = { brotliQuality: opts.brotliQuality, brotliLgwin: opts.brotliLgwin };
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
		// a self-contained folder to copy into flowR: just the .br dictionary + .br shards + the (index-embedding) manifest
		fs.mkdirSync(opts.pack, { recursive: true });
		fs.copyFileSync(`${outBase}${SigDbDictExt}.br`, path.join(opts.pack, `${dictRef.path}.br`));
		for(const ref of shardRefs) {
			fs.copyFileSync(`${outBase}.${ref.id}${SigDbExt}.br`, path.join(opts.pack, `${ref.path}.br`));
		}
		writeManifest(path.join(opts.pack, `${base}.manifest.json`), manifest);
	}
	return manifest;
}

/* -------------------------------------------------------------------------------------------------
 * Reading.
 * ---------------------------------------------------------------------------------------------- */

/** parse a buffer of `["d",start,[...]]` dictionary lines into `strings` (in place) */
function readDictSection(buf: Buffer, strings: string[]): void {
	let off = 0;
	while(off < buf.length) {
		let nl = buf.indexOf(0x0a, off);
		if(nl < 0) {
			nl = buf.length;
		}
		if(nl > off) {
			const [, start, payload] = JSON.parse(buf.toString('utf8', off, nl)) as [string, number, string | string[]];
			const batch = decodeDictBatch(payload);
			for(let k = 0; k < batch.length; k++) {
				strings[start + k] = batch[k];
			}
		}
		off = nl + 1;
	}
}

/** a readable stream of the bundle's plain NDJSON, transparently decompressing `.gz`/`.br` inputs */
function sigDbStream(file: string): Readable {
	return isCompressed(file) ? decompressStream(file) : fs.createReadStream(file);
}

/** stream-read a whole bundle into a {@link SigDb} (any size; never one string). Prefer {@link SigDatabase} for partial access. */
export async function readSignatureDb(file: string): Promise<SigDb> {
	const rl = readline.createInterface({ input: sigDbStream(file), crlfDelay: Infinity });
	let header: Record<string, unknown> | undefined;
	const strings: string[] = [];
	const blobs: PkgBlob[] = [];
	const pkgs: Record<string, number> = {};
	const meta: Record<string, SigDbPkgMeta> = {};
	for await (const line of rl) {
		if(line.length === 0) {
			continue;
		}
		if(header === undefined) {
			header = JSON.parse(line) as Record<string, unknown>;
			continue;
		}
		const tag = line.charCodeAt(2); // '["X",...' -> the tag char
		if(tag === 100 /* d */) {
			const [, start, payload] = JSON.parse(line) as [string, number, string | string[]];
			const batch = decodeDictBatch(payload);
			for(let k = 0; k < batch.length; k++) {
				strings[start + k] = batch[k];
			}
		} else if(tag === 98 /* b */) {
			const [, i, tuple] = JSON.parse(line) as [string, number, PkgBlobTuple];
			blobs[i] = tupleToBlob(tuple);
		} else if(tag === 109 /* m */) {
			const [, , batch] = JSON.parse(line) as [string, number, [string, SigDbPkgMeta][]];
			for(const [name, m] of batch) {
				meta[name] = m;
			}
		} else if(tag === 112 /* p */) {
			const [, , batch] = JSON.parse(line) as [string, number, [string, number][]];
			for(const [name, i] of batch) {
				pkgs[name] = i;
			}
		}
	}
	return { ...(header as object), strings, blobs, pkgs, meta } as unknown as SigDb;
}

/** read just the sidecar index (`<file>.idx`) */
export function readSigDbIndex(plainFile: string): SigDbIndex {
	return decodeIndex(JSON.parse(fs.readFileSync(`${plainFile}.idx`, 'utf8')) as SigDbIndexWire);
}

/** the decoded view of one function at one package version */
export interface DecodedFunction {
	name:      string;
	file?:     string;
	line:      number;
	exported:  boolean;
	props:     string[];
	signature: { name: string, forced: boolean, optional: boolean, default?: string }[];
	callees:   string[];
}

/** decode one of a blob's function records against the global string dictionary */
export function decodeFunction(strings: readonly string[], blob: PkgBlob, fnIdx: number): DecodedFunction {
	const [nameIdx, sigIdx, cgIdx, bits, fileIdx, line] = blob.fns[fnIdx];
	const signature = (sigIdx >= 0 ? blob.sigs[sigIdx] : []).map(p => {
		const [n, flags, def] = Array.isArray(p) ? [p[0], p[1], p.length === 3 ? p[2] : -1] : [p, 0, -1];
		return {
			name:     strings[n],
			forced:   Boolean(flags & ParamFlag.Forced),
			optional: !(flags & ParamFlag.Missing),
			...(def >= 0 ? { default: strings[def] } : {})
		};
	});
	let callees: string[] = [];
	if(cgIdx >= 0) {
		let prev = 0;
		callees = blob.cgs[cgIdx].map(d => strings[prev += d]);
	}
	return {
		name:     strings[nameIdx],
		...(fileIdx >= 0 ? { file: strings[fileIdx] } : {}),
		line,
		exported: Boolean(bits & FnProp.Exported),
		props:    FnPropNames.filter(([m]) => bits & m).map(([, n]) => n),
		signature,
		callees
	};
}

/** a decoded package dependency of one version (`type` is the compact {@link DepType} enum; map to a label via {@link DepTypeNames}) */
export interface ResolvedDependency {
	name:        string;
	type:        DepType;
	/** version qualifier as declared in DESCRIPTION, e.g. `>= 3.0.0` (absent = any version) */
	constraint?: string;
}

/** decode the declared dependencies of one blob version (empty when it declares none / the bundle omits them) */
export function decodeDependencies(strings: readonly string[], blob: PkgBlob, ver: string): ResolvedDependency[] {
	const idx = blob.depsByVersion[ver];
	if(idx === undefined) {
		return [];
	}
	return blob.deps[idx].map(d => ({
		name: strings[d[0]],
		type: d[1],
		...(d.length === 3 ? { constraint: strings[d[2]] } : {})
	}));
}

/** the function indices of a blob version (undoing the delta encoding) */
function versionFnIndices(blob: PkgBlob, ver: string): number[] | undefined {
	const list = blob.versions[ver];
	if(list === undefined) {
		return undefined;
	}
	const out: number[] = [];
	let prev = 0;
	for(const d of list) {
		out.push(prev += d);
	}
	return out;
}

/** milliseconds since the Unix epoch for a stored day count (day granularity) */
function dayToMillis(day: number): number {
	return day * 86_400_000;
}

/** one release: a parsed version paired with its release date */
export interface VersionRelease { version: RPackageVersion; date: Date }

/** the known releases of a blob, ascending by R-version order (empty when no dates were stored) */
function releasesOf(blob: PkgBlob | undefined): VersionRelease[] {
	if(!blob) {
		return [];
	}
	return Object.entries(blob.dates)
		.map(([ver, day]) => ({ version: toRVersion(ver), date: new Date(dayToMillis(day)) }))
		.sort((a, b) => RVersion.compare(a.version.str, b.version.str));
}

/** the version with the newest release date (falling back to `latest`, then the highest by SemVer order) */
function newestVersion(blob: PkgBlob, latest: string): string | undefined {
	let best: string | undefined;
	let bestDay = -Infinity;
	for(const [ver, day] of Object.entries(blob.dates)) {
		if(day > bestDay) {
			bestDay = day;
			best = ver;
		}
	}
	if(best !== undefined) {
		return best;
	}
	if(blob.versions[latest]) {
		return latest;
	}
	// no dates and no recorded latest: pick the highest by R's numeric-version order (not string order)
	return highestVersion(Object.keys(blob.versions));
}

/** the highest of some version strings by R's `numeric_version` order (`0.9.0 < 0.10.0`); undefined if none */
function highestVersion(versions: Iterable<string>): string | undefined {
	let best: string | undefined;
	for(const v of versions) {
		if(best === undefined || RVersion.compare(v, best) > 0) {
			best = v;
		}
	}
	return best;
}

/** pick the version tuple: requested, else the package's latest, else the highest present by R-version order */
function resolveVersion(blob: PkgBlob, latest: string, version?: string): string | undefined {
	if(version && blob.versions[version]) {
		return version;
	}
	if(blob.versions[latest]) {
		return latest;
	}
	return highestVersion(Object.keys(blob.versions));
}

/** derive the {@link LibraryExports} export view of one package version from its blob + metadata */
export function deriveLibraryExports(
	strings: readonly string[], blob: PkgBlob, meta: SigDbPkgMeta, pkg: string, version?: string, cranBase = DefaultCranBase
): LibraryExports | undefined {
	const [latest, archived] = meta;
	const ver = resolveVersion(blob, latest, version);
	if(ver === undefined) {
		return undefined;
	}
	const idxs = versionFnIndices(blob, ver) ?? [];
	const exported: string[] = [];
	const internal: string[] = [];
	const deprecated: string[] = [];
	const locations = new Map<string, SigDefinitionLocation>();
	for(const i of idxs) {
		const [nameIdx, , , bits, fileIdx, line] = blob.fns[i];
		const name = strings[nameIdx];
		(bits & FnProp.Exported ? exported : internal).push(name);
		if(bits & FnProp.Deprecated) {
			deprecated.push(name);
		}
		if(fileIdx >= 0) {
			locations.set(name, { file: strings[fileIdx], line });
		}
	}
	const cran = !blob.noncran.includes(ver);
	return {
		version: ver, exported, internal, deprecated, cran,
		cranUrl: cranBlobUrl(cranBase, pkg, ver, { latest, archived: archived === 1, cran }),
		...(locations.size > 0 ? { locations } : {})
	};
}

/**
 * The read interface every package-signature source implements, so a single {@link SigDatabase} and a
 * sharded {@link SigDatabaseSet} are interchangeable. Queries are synchronous; any decompression/caching
 * happens once during `open`.
 */
export interface PackageSignatureSource {
	/** whether the source can resolve the package at all */
	has(pkg: string): boolean;
	/** the export view of a package version (defaults to its latest) */
	lookup(pkg: string, version?: RPackageVersionLike): LibraryExports | undefined;
	/** rich per-function view (signatures + call graphs) of a package version */
	functions(pkg: string, version?: RPackageVersionLike): DecodedFunction[] | undefined;
	/** declared dependencies (Depends/Imports/…) of a package version, with version qualifiers */
	dependencies(pkg: string, version?: RPackageVersionLike): ResolvedDependency[] | undefined;
	/** every package name this source can resolve */
	packageNames(): string[];
	/** whether the package is an R-core / base package (its versions are the R releases it shipped with) */
	isBaseR(pkg: string): boolean;
	/** for a base package, the R versions it was part of core (ascending); `undefined` otherwise */
	coreVersions(pkg: string): RPackageVersion[] | undefined;
	/** the release date of a package version (defaulting to the newest release), or `undefined` if unknown */
	releaseDate(pkg: string, version?: RPackageVersionLike): Date | undefined;
	/** every known release of a package (version + date), ascending by R-version order */
	releaseDates(pkg: string): VersionRelease[];
	/** the newest version of a package by release date (falling back to the recorded latest) */
	latestVersion(pkg: string): RPackageVersion | undefined;
	/** release any held file handles */
	close(): void;
}

/** options controlling where {@link SigDatabase}/{@link SigDatabaseSet} materialize decompressed caches */
export interface SigDbOpenOptions {
	/** directory for the decompressed, hash-keyed cache (default: see {@link sigDbCacheDir}) */
	cacheDir?: string;
	/** content hash to key the cache (avoids reading the source header; supplied from a manifest) */
	hash?:     string;
	/** index to use instead of a sibling `.idx` (supplied from a manifest so no `.idx` file need ship) */
	index?:    SigDbIndex;
}

/** read and parse just the header (line 1) from a buffer/string of NDJSON */
function parseHeader(text: string): Record<string, unknown> | undefined {
	const nl = text.indexOf('\n');
	try {
		return JSON.parse(nl >= 0 ? text.slice(0, nl) : text) as Record<string, unknown>;
	} catch{
		return undefined;
	}
}

/**
 * Directory for decompressed, hash-keyed caches. Honours `$FLOWR_SIGDB_CACHE` / `$FLOWR_CACHE_DIR` /
 * `$XDG_CACHE_HOME`, then `~/.cache/flowr`, falling back to the OS temp dir (so it works in a read-only
 * Docker image where only `/tmp` is writable — mount a volume at the cache dir to persist it).
 */
export function sigDbCacheDir(override?: string): string {
	const base = override
		?? process.env.FLOWR_SIGDB_CACHE ?? process.env.FLOWR_CACHE_DIR
		?? (process.env.XDG_CACHE_HOME ? path.join(process.env.XDG_CACHE_HOME, 'flowr') : undefined)
		?? path.join(os.homedir?.() || os.tmpdir(), '.cache', 'flowr');
	const dir = path.join(base, 'sigdb');
	try {
		fs.mkdirSync(dir, { recursive: true });
		return dir;
	} catch{
		const tmp = path.join(os.tmpdir(), 'flowr-sigdb-cache');
		fs.mkdirSync(tmp, { recursive: true });
		return tmp;
	}
}

const isCompressed = (f: string): boolean => f.endsWith('.br') || f.endsWith('.gz');
function decompressStream(file: string): Readable {
	const raw = fs.createReadStream(file);
	return file.endsWith('.br')
		? raw.pipe(zlib.createBrotliDecompress({ params: { [zlib.constants.BROTLI_DECODER_PARAM_LARGE_WINDOW]: 1 } }))
		: raw.pipe(zlib.createGunzip());
}

/** read the (small) header line of a possibly-compressed bundle without decompressing the whole thing */
async function readHeaderOf(source: string): Promise<Record<string, unknown> | undefined> {
	if(!isCompressed(source)) {
		const fd = fs.openSync(source, 'r');
		try {
			const buf = Buffer.allocUnsafe(65536);
			const n = fs.readSync(fd, buf, 0, buf.length, 0);
			return parseHeader(buf.toString('utf8', 0, n));
		} finally {
			fs.closeSync(fd);
		}
	}
	const rl = readline.createInterface({ input: decompressStream(source), crlfDelay: Infinity });
	try {
		for await (const line of rl) {
			return JSON.parse(line) as Record<string, unknown>;
		}
	} finally {
		rl.close();
	}
	return undefined;
}

/** where an index for a decompressed source comes from — a caller-supplied one (e.g. a manifest) or the sibling `.idx` */
interface EnsureOptions {
	cacheDir?:  string;
	hash?:      string;
	index?:     SigDbIndex;
	/** the source is not a seekable bundle (e.g. a shared dictionary file) — decompress only, write no `.idx` */
	indexless?: boolean;
}

/** the cache paths for a source given its content hash */
function cachePaths(hash: string, cacheDir?: string): { plain: string, idx: string } {
	const plain = path.join(sigDbCacheDir(cacheDir), `sigdb-${hash}${SigDbExt}`);
	return { plain, idx: `${plain}.idx` };
}

/** materialize the `.idx` for a freshly decompressed cache file — from the supplied index or the source's sibling */
function writeCacheIndex(source: string, idx: string, index?: SigDbIndex): void {
	if(index) {
		fs.writeFileSync(idx, JSON.stringify(encodeIndex(index)));
		return;
	}
	const srcIdx = source.replace(/\.(br|gz)$/, '') + '.idx';
	if(!fs.existsSync(srcIdx)) {
		throw new Error(`missing sidecar index next to ${source} (expected ${srcIdx}), and none was supplied`);
	}
	fs.copyFileSync(srcIdx, idx);
}

/**
 * Ensure a seekable plain `.sigs.ndjson` (+ its `.idx`) exists for `source`, decompressing a `.br`/`.gz`
 * once into a hash-keyed cache the first time and reusing it on every later startup. The index may be
 * supplied by the caller (e.g. embedded in a manifest) so no separate `.idx` file needs to ship.
 */
async function ensurePlain(source: string, opts: EnsureOptions = {}): Promise<string> {
	if(!isCompressed(source)) {
		return source;
	}
	let hash = opts.hash;
	if(hash === undefined) {
		const content = (await readHeaderOf(source))?.content as SigDbContent | undefined;
		hash = content?.hash ?? hash53(source);
	}
	const { plain, idx } = cachePaths(hash, opts.cacheDir);
	if(fs.existsSync(plain) && (opts.indexless || fs.existsSync(idx))) {
		return plain;
	}
	const tmp = `${plain}.${process.pid}.tmp`;
	await pipeline(decompressStream(source), fs.createWriteStream(tmp));
	fs.renameSync(tmp, plain);
	if(!opts.indexless) {
		writeCacheIndex(source, idx, opts.index);
	}
	return plain;
}

/** synchronous {@link ensurePlain} (blocking brotli/gunzip) — a `hash` must be supplied to key the cache */
function ensurePlainSync(source: string, opts: EnsureOptions & { hash: string }): string {
	if(!isCompressed(source)) {
		return source;
	}
	const { plain, idx } = cachePaths(opts.hash, opts.cacheDir);
	if(fs.existsSync(plain) && (opts.indexless || fs.existsSync(idx))) {
		return plain;
	}
	const raw = fs.readFileSync(source);
	const out = source.endsWith('.br')
		? zlib.brotliDecompressSync(raw, { params: { [zlib.constants.BROTLI_DECODER_PARAM_LARGE_WINDOW]: 1 } })
		: zlib.gunzipSync(raw);
	const tmp = `${plain}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, out);
	fs.renameSync(tmp, plain);
	if(!opts.indexless) {
		writeCacheIndex(source, idx, opts.index);
	}
	return plain;
}

/**
 * Fast, partial reader for a single bundle. `open()`/`openSync()` load the string dictionary + `.idx`
 * once (a single ranged read of the dictionary section — no full parse), then every query seeks straight
 * to one package blob on demand. `open()` additionally decompresses a `.br`/`.gz` source into a
 * hash-keyed cache and reuses it on later startups. Implements {@link PackageSignatureSource}.
 */
export class SigDatabase implements PackageSignatureSource {
	private closed = false;
	/** parsed blobs by blob index so repeated lookups skip the re-read + JSON.parse; FIFO-bounded to cap memory */
	private readonly blobCache = new Map<number, PkgBlob>();
	private static readonly BlobCacheCap = 2048;
	private constructor(
		private readonly fd: number,
		readonly strings: string[],
		readonly index: SigDbIndex,
		readonly content: SigDbContent | undefined,
		private readonly cranBase: string
	) {}

	/**
	 * Open a plain, seekable `.sigs.ndjson` synchronously. Pass `index` to skip reading the `.idx` sidecar,
	 * and `strings` to use an already-loaded shared dictionary instead of the file's own `d` section (for a
	 * blob-only shard). One ranged read loads the dictionary — no readline overhead.
	 */
	public static openSync(plainFile: string, opts: { index?: SigDbIndex, strings?: string[] } = {}): SigDatabase {
		if(isCompressed(plainFile)) {
			throw new Error('SigDatabase.openSync needs the plain .sigs.ndjson; use open() for .br/.gz');
		}
		const index = opts.index ?? readSigDbIndex(plainFile);
		const fd = fs.openSync(plainFile, 'r');
		const head = Buffer.allocUnsafe(Math.min(65536, index.byteCount));
		fs.readSync(fd, head, 0, head.length, 0);
		const header = parseHeader(head.toString('utf8'));
		let strings = opts.strings;
		if(!strings) {
			strings = [];
			const [dictStart, dictBytes] = index.dict;
			if(dictBytes > 0) {
				const buf = Buffer.allocUnsafe(dictBytes);
				fs.readSync(fd, buf, 0, dictBytes, dictStart);
				readDictSection(buf, strings);
			}
		}
		const cranBase = (header?.cranBase as string | undefined) ?? DefaultCranBase;
		return new SigDatabase(fd, strings, index, header?.content as SigDbContent | undefined, cranBase);
	}

	/** open a `.sigs.ndjson`, `.br` or `.gz`; compressed sources are decompressed into a hash-keyed cache once */
	public static async open(source: string, opts: SigDbOpenOptions = {}): Promise<SigDatabase> {
		return SigDatabase.openSync(await ensurePlain(source, opts));
	}

	/**
	 * Like {@link open} but fully synchronous (blocking decompression); a `hash` keys the cache when `source`
	 * is compressed. Pass `strings` for a blob-only shard that shares an already-loaded dictionary.
	 */
	public static openSyncFrom(source: string, opts: SigDbOpenOptions & { hash?: string, index?: SigDbIndex, strings?: string[] }): SigDatabase {
		const plain = isCompressed(source)
			? (opts.hash !== undefined ? ensurePlainSync(source, { cacheDir: opts.cacheDir, hash: opts.hash, index: opts.index })
				: (() => {
					throw new Error('openSyncFrom needs a hash to key the cache for a compressed source');
				})())
			: source;
		return SigDatabase.openSync(plain, { index: opts.index, strings: opts.strings });
	}

	public has(pkg: string): boolean {
		return this.index.pkgs[pkg] !== undefined;
	}

	public packageNames(): string[] {
		return Object.keys(this.index.pkgs);
	}

	/** load a single package's blob by seeking to its line (undefined if absent); cached by blob index */
	public blob(pkg: string): PkgBlob | undefined {
		const blobIdx = this.index.pkgs[pkg];
		if(blobIdx === undefined) {
			return undefined;
		}
		const cached = this.blobCache.get(blobIdx);
		if(cached !== undefined) {
			return cached;
		}
		const [locStart, locBytes] = this.index.blobs[blobIdx];
		const buf = Buffer.allocUnsafe(locBytes);
		fs.readSync(this.fd, buf, 0, locBytes, locStart);
		const [, , tuple] = JSON.parse(buf.toString('utf8')) as [string, number, PkgBlobTuple];
		const blob = tupleToBlob(tuple);
		if(this.blobCache.size >= SigDatabase.BlobCacheCap) {
			const oldest = this.blobCache.keys().next().value;
			if(oldest !== undefined) {
				this.blobCache.delete(oldest);
			}
		}
		this.blobCache.set(blobIdx, blob);
		return blob;
	}

	/** read every unique package blob in index order (used to re-hash a whole shard during verification) */
	public allBlobs(): PkgBlob[] {
		return this.index.blobs.map(([start, bytes]) => {
			const buf = Buffer.allocUnsafe(bytes);
			fs.readSync(this.fd, buf, 0, bytes, start);
			const [, , tuple] = JSON.parse(buf.toString('utf8')) as [string, number, PkgBlobTuple];
			return tupleToBlob(tuple);
		});
	}

	/** recompute this bundle's self-contained content hash from its re-read data (matches {@link writeSignatureDb}) */
	public contentHash(blobs = this.allBlobs()): string {
		// use only this bundle's own package metadata, in package-index order — a shared manifest may hoist a
		// superset of metadata that the self-contained bundle was NOT hashed over
		const meta: Record<string, SigDbPkgMeta> = {};
		for(const pkg of Object.keys(this.index.pkgs)) {
			meta[pkg] = this.index.meta[pkg];
		}
		return hashOf(hashChunks({ strings: this.strings, blobs, pkgs: this.index.pkgs, meta }));
	}

	/** whether this bundle actually carries the given version of a package (not just the package) */
	public hasVersion(pkg: string, version: RPackageVersionLike): boolean {
		return this.blob(pkg)?.versions[versionKey(version) as string] !== undefined;
	}

	public lookup(pkg: string, version?: RPackageVersionLike): LibraryExports | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		if(!blob || !meta) {
			return undefined;
		}
		return deriveLibraryExports(this.strings, blob, meta, pkg, versionKey(version), this.cranBase);
	}

	public functions(pkg: string, version?: RPackageVersionLike): DecodedFunction[] | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		if(!blob || !meta) {
			return undefined;
		}
		const ver = resolveVersion(blob, meta[0], versionKey(version));
		const idxs = ver !== undefined ? versionFnIndices(blob, ver) : undefined;
		return idxs?.map(i => decodeFunction(this.strings, blob, i));
	}

	public dependencies(pkg: string, version?: RPackageVersionLike): ResolvedDependency[] | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		if(!blob || !meta) {
			return undefined;
		}
		const ver = resolveVersion(blob, meta[0], versionKey(version));
		return ver !== undefined ? decodeDependencies(this.strings, blob, ver) : undefined;
	}

	/** whether this is an R-core / base package (its versions are the R releases it shipped with; see {@link SigDbPkgMeta}) */
	public isBaseR(pkg: string): boolean {
		return this.index.meta[pkg]?.[3] === 1;
	}

	/**
	 * The R versions a base package was part of core, in ascending R-version order (exactly its stored
	 * versions). `undefined` for a non-base package. E.g. `mva` returns `…1.9.1`, `parallel` `2.14.0…`.
	 */
	public coreVersions(pkg: string): RPackageVersion[] | undefined {
		if(!this.isBaseR(pkg)) {
			return undefined;
		}
		return Object.keys(this.blob(pkg)?.versions ?? {}).map(toRVersion).sort((a, b) => RVersion.compare(a.str, b.str));
	}

	/** the release date of a package version (defaulting to the newest release), or `undefined` if unknown */
	public releaseDate(pkg: string, version?: RPackageVersionLike): Date | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		if(!blob || !meta) {
			return undefined;
		}
		const ver = versionKey(version) ?? newestVersion(blob, meta[0]);
		const day = ver !== undefined ? blob.dates[ver] : undefined;
		return day !== undefined ? new Date(dayToMillis(day)) : undefined;
	}

	/** every known release date of a package, in ascending R-version order (empty when no dates were stored) */
	public releaseDates(pkg: string): VersionRelease[] {
		return releasesOf(this.blob(pkg));
	}

	/** the newest version of a package by release date (falling back to the recorded latest, then SemVer order) */
	public latestVersion(pkg: string): RPackageVersion | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		const ver = blob && meta ? newestVersion(blob, meta[0]) : undefined;
		return ver !== undefined ? toRVersion(ver) : undefined;
	}

	/** close the underlying file descriptor (idempotent; safe to call more than once) */
	public close(): void {
		if(!this.closed) {
			this.closed = true;
			this.blobCache.clear();
			fs.closeSync(this.fd);
		}
	}
}

/* -------------------------------------------------------------------------------------------------
 * Sharded databases: a manifest routes packages/versions to the shard file that holds them, so the
 * data can be split (e.g. current-top / current-rest / full-top / full-rest) yet read transparently.
 * ---------------------------------------------------------------------------------------------- */

export const SigDbManifestMagic = 'flowr-sigdb-manifest';
export const SigDbManifestSchema = 2;

/** one shard within a {@link SigDbManifest} */
export interface SigDbShardRef {
	/** stable id, e.g. `current-top` */
	id:       string;
	tier:     SigDbTier;
	shard?:   SigDbShard;
	topN?:    number;
	/** path to the shard's `.sigs.ndjson` (relative to the manifest); the `.br` alongside is used when only it ships */
	path:     string;
	hash:     string;
	packages: number;
	versions: number;
	/** id of the shared dictionary this shard's blobs reindex into (see {@link SigDbManifest.dicts}) */
	dict?:    string;
	/**
	 * the shard's compact index embedded in the manifest (without its own `meta`/`d` — those are shared). A
	 * reader routes and seeks from the manifest alone, needing only the `.br` files (no `.idx` sidecars).
	 */
	idx?:     SigDbIndexWire | SigShardIndexWire;
}

/** a set of shard files (and shared dictionaries) plus the routing needed to read them as one database */
export interface SigDbManifest {
	format:    string;
	schema:    number;
	date:      string;
	generated: number;
	cranBase?: string;
	/** package metadata, hoisted here once and shared by every shard (they hold overlapping package sets) */
	meta?:     Record<string, SigDbPkgMeta>;
	/** shared string dictionaries; a shard references one by id (they are stored once, not per shard) */
	dicts?:    SigDbDictRef[];
	shards:    SigDbShardRef[];
}

/** write a {@link SigDbManifest} (compact JSON) plus a brotli-compressed `.br` beside it */
export function writeManifest(file: string, manifest: SigDbManifest): void {
	fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
	const json = JSON.stringify(manifest);
	fs.writeFileSync(file, json);
	fs.writeFileSync(`${file}.br`, zlib.brotliCompressSync(json, { params: {
		[zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: json.length
	} }));
}

/** breadth/temporal scope of a bundled sigdb: base R only, `current` (latest CRAN + base R), or the `full` history */
export type SigDbScope = 'base' | 'current' | 'full';
/** richest first: a container shipping the full set uses it, else the slim `current`, else the npm-bundled `base` */
const SigDbScopeOrder: readonly SigDbScope[] = ['full', 'current', 'base'];
/** layouts a bundled sigdb may sit in, relative to a search root — the root itself (e.g. a `$FLOWR_SIGDB_DIR` data mount), then the dev `src`, build `dist` and data-dir layouts */
const SigDbSubDirs = ['', 'data/sigdb', 'src/data/sigdb', 'dist/src/data/sigdb'];

/** roots to search for a bundled sigdb; extendable via `$FLOWR_SIGDB_DIR` (path-delimiter separated) */
function sigDbSearchRoots(extra?: readonly string[]): string[] {
	const roots = [...(extra ?? [])];
	const env = typeof process !== 'undefined' ? process.env?.FLOWR_SIGDB_DIR : undefined;
	if(env) {
		roots.push(...env.split(path.delimiter).filter(Boolean));
	}
	if(typeof __dirname !== 'undefined') {
		roots.push(__dirname);
	}
	if(typeof process !== 'undefined' && typeof process.cwd === 'function') {
		roots.push(process.cwd());
	}
	return roots;
}

/**
 * Location of a bundled sigdb **manifest**, found by walking up from several roots (this module,
 * `$FLOWR_SIGDB_DIR`, the working directory) across the dev (`src`), build (`dist`) and data-mount
 * layouts. With no `scope` it returns the richest available (`full` &gt; `current` &gt; `base`), so a
 * container that ships the full set uses it automatically while a plain npm install falls back to the
 * bundled `base`. Node only (needs `fs`); pass `searchRoots` to override where it looks.
 */
export function defaultSigDbPath(scope?: SigDbScope, searchRoots?: readonly string[]): string | undefined {
	if(typeof fs?.existsSync !== 'function') {
		return undefined;
	}
	const scopes = scope ? [scope] : SigDbScopeOrder;
	for(const root of sigDbSearchRoots(searchRoots)) {
		for(let dir = root, i = 0; i < 10; i++) {
			for(const sub of SigDbSubDirs) {
				for(const s of scopes) {
					for(const suffix of ['', '.br']) {
						const candidate = path.join(dir, sub, `${s}.manifest.json${suffix}`);
						if(fs.existsSync(candidate)) {
							return candidate;
						}
					}
				}
			}
			const parent = path.dirname(dir);
			if(parent === dir) {
				break;
			}
			dir = parent;
		}
	}
	return undefined;
}

/**
 * Every distinct sigdb bundle discoverable in the search dirs (see {@link defaultSigDbPath}) -- not just the
 * richest scope. So dropping an extra bundle next to the shipped default (a downloaded full-history
 * `full.manifest.json.br`, a custom `*.manifest.json`, or a standalone `*.sigs.ndjson`) makes flowR mount it
 * automatically. Manifests come first (scope-named leading, richest scope first), then standalone bundles; the
 * shard and dictionary files a manifest already owns are skipped. Deduped by filename, first search location wins.
 */
export function defaultSigDbPaths(searchRoots?: readonly string[]): string[] {
	if(typeof fs?.readdirSync !== 'function') {
		return [];
	}
	const manifests = new Map<string, string>();    // `<name>.manifest.json` (ignoring `.br`) -> first-found path
	const standalones = new Map<string, string>();   // `<name>.sigs.ndjson` (ignoring `.br`) -> first-found path
	for(const root of sigDbSearchRoots(searchRoots)) {
		for(let dir = root, i = 0; i < 10; i++) {
			for(const sub of SigDbSubDirs) {
				let entries: string[];
				try {
					entries = fs.readdirSync(path.join(dir, sub));
				} catch{
					continue;   // directory does not exist on this root
				}
				for(const file of entries) {
					const full = path.join(dir, sub, file);
					if(/\.manifest\.json(\.br)?$/.test(file)) {
						manifests.set(file.replace(/\.br$/, ''), manifests.get(file.replace(/\.br$/, '')) ?? full);
					} else if(new RegExp(`${SigDbExt.replace('.', '\\.')}(\\.br)?$`).test(file) && !file.includes('.dict' + SigDbExt)) {
						standalones.set(file.replace(/\.br$/, ''), standalones.get(file.replace(/\.br$/, '')) ?? full);
					}
				}
			}
			const parent = path.dirname(dir);
			if(parent === dir) {
				break;
			}
			dir = parent;
		}
	}
	// a standalone bundle is a `.sigs.ndjson` that is not a shard of a discovered manifest (`<manifest>.<shard>...`)
	const prefixes = [...manifests.keys()].map(k => k.replace(/\.manifest\.json$/, ''));
	const isShard = (name: string): boolean => {
		const base = name.replace(new RegExp(`${SigDbExt.replace('.', '\\.')}$`), '');
		return prefixes.some(p => base === p || base.startsWith(p + '.'));
	};
	const scopeRank = (name: string): number => {
		const scope = SigDbScopeOrder.indexOf(name.replace(/\.manifest\.json$/, '') as SigDbScope);
		return scope === -1 ? SigDbScopeOrder.length : scope;   // custom bundles sort after the known scopes
	};
	const orderedManifests = [...manifests.entries()]
		.sort((a, b) => scopeRank(a[0]) - scopeRank(b[0]) || a[0].localeCompare(b[0])).map(([, p]) => p);
	const bundles = [...standalones.entries()].filter(([name]) => !isShard(name)).map(([, p]) => p);
	return [...orderedManifests, ...bundles];
}

/** read a manifest file (transparently decompressing a `.br`) */
export function readManifestFile(manifestFile: string): SigDbManifest {
	const raw = fs.readFileSync(manifestFile);
	const text = manifestFile.endsWith('.br') ? zlib.brotliDecompressSync(raw).toString('utf8') : raw.toString('utf8');
	return JSON.parse(text) as SigDbManifest;
}

/** resolve a manifest-relative file to a compressed (`.br`) source when present, else the plain path */
function resolveSource(baseDir: string, relPath: string): string {
	const plain = path.resolve(baseDir, relPath);
	const br = `${plain}.br`;
	return fs.existsSync(plain) ? plain : fs.existsSync(br) ? br : plain;
}

/** load `<shard.path>` as a compressed (`.br`) source when present, else the plain `.ndjson` */
function shardSource(baseDir: string, ref: SigDbShardRef): string {
	return resolveSource(baseDir, ref.path);
}

/** current-tier shards are preferred over full-tier ones (smaller/faster) when both can serve a request */
function tierRank(ref: SigDbShardRef): number {
	return ref.tier === 'current' ? 0 : 1;
}

/** options for {@link SigDatabaseSet.openManifest} — the base cache options plus per-shard enable/disable */
export interface SigDbSetOpenOptions extends SigDbOpenOptions {
	/** only load these shard ids (e.g. `['base-current','current-top']`); omit to load all */
	includeShards?: readonly string[];
	/** load every shard except these ids (e.g. `['full-top','full-rest']` for a current-only view) */
	excludeShards?: readonly string[];
}

/** apply the include/exclude shard filters (include first, then exclude), preserving manifest order */
function selectShards(shards: readonly SigDbShardRef[], include?: readonly string[], exclude?: readonly string[]): SigDbShardRef[] {
	let out = include ? shards.filter(s => include.includes(s.id)) : [...shards];
	if(exclude) {
		out = out.filter(s => !exclude.includes(s.id));
	}
	return out;
}

/**
 * A transparent, read-only view over several {@link SigDatabase} shards described by a {@link SigDbManifest}.
 * When the manifest embeds each shard's index (the default), `openManifest()` reads only that small file to
 * build the package to shard routing table — **no shard is decompressed up front**. A shard's `.br` is
 * decompressed into the hash-keyed cache and opened only the first time a package it holds is queried (or
 * eagerly via {@link preload}, which runs in the background). Queries prefer the smallest shard that can
 * serve them (a `current` shard for the latest version, falling back to a `full` shard for a pinned older
 * version). Implements {@link PackageSignatureSource}.
 */
export class SigDatabaseSet implements PackageSignatureSource {
	private readonly opened: (SigDatabase | undefined)[];

	private constructor(
		readonly manifest: SigDbManifest,
		private readonly baseDir: string,
		private readonly indices: SigDbIndex[],
		/** package name to shard indices, ordered by preference (current before full) */
		private readonly routes: Map<string, number[]>,
		private readonly cacheDir?: string
	) {
		this.opened = new Array<SigDatabase | undefined>(manifest.shards.length).fill(undefined);
	}

	/** read + validate a manifest and apply the include/exclude shard filter */
	private static prepManifest(manifestFile: string, opts: SigDbSetOpenOptions): { baseDir: string, manifest: SigDbManifest } {
		const baseDir = path.dirname(manifestFile);
		const full = readManifestFile(manifestFile);
		if(full.format !== SigDbManifestMagic) {
			throw new Error(`not a ${SigDbManifestMagic} (got ${String(full.format)})`);
		}
		// enable/disable shards by id: e.g. `{ excludeShards: ['full-top','full-rest'] }` for a current-only
		// (latest-version) view that never opens the history shards. The shared dictionary + hoisted meta stay.
		const active = selectShards(full.shards, opts.includeShards, opts.excludeShards);
		if(active.length === 0) {
			throw new Error('openManifest: no shards left after include/exclude filtering');
		}
		return { baseDir, manifest: { ...full, shards: active } };
	}

	/** build the package to shard routing (current before full) and construct the set from resolved indices */
	private static assemble(manifest: SigDbManifest, baseDir: string, indices: SigDbIndex[], cacheDir?: string): SigDatabaseSet {
		const order = manifest.shards.map((_, i) => i).sort((a, b) => tierRank(manifest.shards[a]) - tierRank(manifest.shards[b]));
		const routes = new Map<string, number[]>();
		for(const i of order) {
			for(const pkg of Object.keys(indices[i].pkgs)) {
				const list = routes.get(pkg);
				if(list) {
					list.push(i);
				} else {
					routes.set(pkg, [i]);
				}
			}
		}
		return new SigDatabaseSet(manifest, baseDir, indices, routes, cacheDir);
	}

	public static async openManifest(manifestFile: string, opts: SigDbSetOpenOptions = {}): Promise<SigDatabaseSet> {
		const { baseDir, manifest } = SigDatabaseSet.prepManifest(manifestFile, opts);
		// prefer the embedded (compact) index with hoisted meta; only fall back to a shard's own .idx if absent
		const indices = await Promise.all(manifest.shards.map(async s =>
			s.idx ? decodeIndex(s.idx, manifest.meta) : readSigDbIndex(await ensurePlain(shardSource(baseDir, s), { cacheDir: opts.cacheDir, hash: s.hash }))));
		return SigDatabaseSet.assemble(manifest, baseDir, indices, opts.cacheDir);
	}

	/**
	 * Synchronous {@link openManifest} — needs every shard to embed its index (the default for the bundles
	 * flowR ships, so no `.idx` sidecar to read). Shards and dictionaries still decompress lazily (and
	 * synchronously) on first access, so opening stays cheap. Lets the manifest be loaded from a purely
	 * synchronous context (e.g. the package-version plugin's sync source path).
	 */
	public static openManifestSync(manifestFile: string, opts: SigDbSetOpenOptions = {}): SigDatabaseSet {
		const { baseDir, manifest } = SigDatabaseSet.prepManifest(manifestFile, opts);
		const indices = manifest.shards.map(s => {
			if(!s.idx) {
				throw new Error(`openManifestSync needs every shard to embed its index; shard '${s.id}' does not — use openManifest`);
			}
			return decodeIndex(s.idx, manifest.meta);
		});
		return SigDatabaseSet.assemble(manifest, baseDir, indices, opts.cacheDir);
	}

	/** shared dictionaries, loaded (decompressed + parsed) once and cached by id */
	private readonly dictCache = new Map<string, string[]>();

	/** load (and cache) a shared dictionary's strings, decompressing its `.br` into the cache once */
	private dictionaryStrings(dictId: string): string[] {
		const cached = this.dictCache.get(dictId);
		if(cached) {
			return cached;
		}
		const ref = this.manifest.dicts?.find(d => d.id === dictId);
		if(!ref) {
			throw new Error(`manifest references unknown dictionary '${dictId}'`);
		}
		const plain = ensurePlainSync(resolveSource(this.baseDir, ref.path), { cacheDir: this.cacheDir, hash: ref.hash, indexless: true });
		const strings: string[] = [];
		const fd = fs.openSync(plain, 'r');
		try {
			const [start, bytes] = ref.range;
			const buf = Buffer.allocUnsafe(bytes);
			fs.readSync(fd, buf, 0, bytes, start);
			readDictSection(buf, strings);
		} finally {
			fs.closeSync(fd);
		}
		this.dictCache.set(dictId, strings);
		return strings;
	}

	/** lazily open a shard — decompressing its `.br` (and its shared dictionary) into the cache on first access */
	private shard(i: number): SigDatabase {
		const existing = this.opened[i];
		if(existing) {
			return existing;
		}
		const ref = this.manifest.shards[i];
		const strings = ref.dict ? this.dictionaryStrings(ref.dict) : undefined;
		const db = SigDatabase.openSyncFrom(shardSource(this.baseDir, ref),
			{ cacheDir: this.cacheDir, hash: ref.hash, index: this.indices[i], strings });
		this.opened[i] = db;
		return db;
	}

	/**
	 * Warm the shards (and their shared dictionaries) needed for `pkgs`, or **everything** when omitted -- which
	 * is how you make history (pinned older versions, served by the `full` shards) fast: it decompresses every
	 * needed shard and dictionary `.br` **concurrently** (stream brotli runs on the libuv threadpool, so this
	 * parallelizes across cores instead of the serial per-query decompression), then opens each shard from the
	 * decompressed cache (parsing each shared dictionary once). Afterwards the synchronous query methods -- for
	 * the latest *and* historical versions -- do no I/O or decompression.
	 */
	public async preload(pkgs?: readonly string[]): Promise<void> {
		const need = new Set<number>();
		if(pkgs) {
			for(const p of pkgs) {
				for(const i of this.routes.get(p) ?? []) {
					need.add(i);
				}
			}
		} else {
			this.manifest.shards.forEach((_, i) => need.add(i));
		}
		await this.warmShards(need);
	}

	/**
	 * Warm just the shards matching `include` -- e.g. only the current-tier top shards (the base + most-downloaded
	 * packages) to speed up common lookups without paying for the long tail or the history shards. See {@link preload}.
	 */
	public async preloadShards(include: (shard: SigDbShardRef) => boolean): Promise<void> {
		const need = new Set<number>();
		this.manifest.shards.forEach((s, i) => {
			if(include(s)) {
				need.add(i);
			}
		});
		await this.warmShards(need);
	}

	/** decompress the given shards + their shared dictionaries concurrently, then open them (see {@link preload}) */
	private async warmShards(need: ReadonlySet<number>): Promise<void> {
		const dicts = new Set<string>();
		for(const i of need) {
			const d = this.manifest.shards[i].dict;
			if(d) {
				dicts.add(d);
			}
		}
		await Promise.all([
			...[...need].map(i => ensurePlain(shardSource(this.baseDir, this.manifest.shards[i]),
				{ cacheDir: this.cacheDir, hash: this.manifest.shards[i].hash, index: this.indices[i] })),
			...[...dicts].map(id => {
				const ref = this.manifest.dicts?.find(d => d.id === id);
				return ref ? ensurePlain(resolveSource(this.baseDir, ref.path), { cacheDir: this.cacheDir, hash: ref.hash, indexless: true }) : Promise.resolve('');
			})
		]);
		// open each shard from the now-decompressed cache (cheap; parses each shared dictionary once) so later
		// synchronous queries -- including historical, pinned-version lookups -- never block
		for(const i of need) {
			this.shard(i);
		}
	}

	/** the shard indices that can serve this package, preferred order; optionally requiring a specific version */
	private route(pkg: string, version?: string): number[] {
		const candidates = this.routes.get(pkg) ?? [];
		if(version === undefined) {
			return candidates;
		}
		// keep only shards that actually carry the requested version (current shards may hold only the latest)
		return candidates.filter(i => this.shard(i).hasVersion(pkg, version));
	}

	/** read (once) the blob from the shard with the most complete history — a `full` or `history` tier if present */
	private historyBlob(pkg: string): PkgBlob | undefined {
		const candidates = this.routes.get(pkg);
		if(!candidates || candidates.length === 0) {
			return undefined;
		}
		const full = candidates.find(i => this.manifest.shards[i].tier === 'full' || this.manifest.shards[i].tier === 'history');
		return this.shard(full ?? candidates[0]).blob(pkg);
	}

	public has(pkg: string): boolean {
		return this.routes.has(pkg);
	}

	/** whether any active shard actually carries the given version of a package (not just the package) */
	public hasVersion(pkg: string, version: RPackageVersionLike): boolean {
		return this.route(pkg, versionKey(version)).length > 0;
	}

	public packageNames(): string[] {
		return [...this.routes.keys()];
	}

	/** open (blocking) and return every shard database with its manifest ref — used for whole-set verification */
	public allShards(): { ref: SigDbShardRef, db: SigDatabase }[] {
		return this.manifest.shards.map((ref, i) => ({ ref, db: this.shard(i) }));
	}

	/** load (and cache) a shared dictionary's strings by id — for verification/inspection */
	public sharedDictionary(id: string): string[] {
		return this.dictionaryStrings(id);
	}

	public lookup(pkg: string, version?: RPackageVersionLike): LibraryExports | undefined {
		const key = versionKey(version);
		for(const i of this.route(pkg, key)) {
			const r = this.shard(i).lookup(pkg, key);
			if(r) {
				return r;
			}
		}
		return undefined;
	}

	public functions(pkg: string, version?: RPackageVersionLike): DecodedFunction[] | undefined {
		const key = versionKey(version);
		for(const i of this.route(pkg, key)) {
			const r = this.shard(i).functions(pkg, key);
			if(r) {
				return r;
			}
		}
		return undefined;
	}

	public dependencies(pkg: string, version?: RPackageVersionLike): ResolvedDependency[] | undefined {
		const key = versionKey(version);
		for(const i of this.route(pkg, key)) {
			const r = this.shard(i).dependencies(pkg, key);
			if(r) {
				return r;
			}
		}
		return undefined;
	}

	/** whether this is an R-core / base package (see {@link SigDatabase.isBaseR}); O(1) via the hoisted metadata */
	public isBaseR(pkg: string): boolean {
		const meta = this.manifest.meta?.[pkg];
		if(meta) {
			return meta[3] === 1;
		}
		return this.route(pkg).some(i => this.shard(i).isBaseR(pkg));
	}

	/** the R versions a base package was part of core (ascending); `undefined` if not a base package */
	public coreVersions(pkg: string): RPackageVersion[] | undefined {
		if(!this.isBaseR(pkg)) {
			return undefined;
		}
		return Object.keys(this.historyBlob(pkg)?.versions ?? {}).map(toRVersion).sort((a, b) => RVersion.compare(a.str, b.str));
	}

	/** every known release of a package (version + date), ascending — read once from the most complete shard */
	public releaseDates(pkg: string): VersionRelease[] {
		return releasesOf(this.historyBlob(pkg));
	}

	/** the release date of a package version (defaulting to the newest release), or `undefined` if unknown */
	public releaseDate(pkg: string, version?: RPackageVersionLike): Date | undefined {
		const blob = this.historyBlob(pkg);
		if(!blob) {
			return undefined;
		}
		const ver = versionKey(version) ?? newestVersion(blob, this.manifest.meta?.[pkg]?.[0] ?? '');
		const day = ver !== undefined ? blob.dates[ver] : undefined;
		return day !== undefined ? new Date(dayToMillis(day)) : undefined;
	}

	/** the newest version of a package by release date (falling back to the recorded latest, then SemVer order) */
	public latestVersion(pkg: string): RPackageVersion | undefined {
		const blob = this.historyBlob(pkg);
		const ver = blob ? newestVersion(blob, this.manifest.meta?.[pkg]?.[0] ?? '') : undefined;
		return ver !== undefined ? toRVersion(ver) : undefined;
	}

	/**
	 * Close every opened shard's file descriptor and drop the in-memory caches (opened shards + shared
	 * dictionaries), so the (potentially large) dictionary strings can be reclaimed by the GC. Idempotent.
	 */
	public close(): void {
		for(const db of this.opened) {
			db?.close();
		}
		this.opened.fill(undefined);
		this.dictCache.clear();
	}
}

/* -------------------------------------------------------------------------------------------------
 * Process-wide shared source cache: a bundle *path* is opened at most once per process and reused by
 * every analyzer (and the sigdb query), so the multi-MB dictionary is never loaded twice. Instances are
 * read-only and safe to share; they live for the process (bounded by the few distinct bundle paths in
 * use, not per analysis) so a discarded analyzer never leaks its bundle. Call {@link closeSharedSigSources}
 * on teardown to release the file descriptors and cached strings.
 * ---------------------------------------------------------------------------------------------- */

const sharedSources = new Map<string, PackageSignatureSource>();

/** whether a bundle path can be opened synchronously (a plain `.sigs.ndjson` or an index-embedding manifest) */
function isSyncOpenable(source: string): boolean {
	return source.endsWith('.manifest.json') || source.endsWith('.manifest.json.br') || source.endsWith(SigDbExt);
}

/**
 * Open a path-based source once, process-wide, synchronously. Returns the shared instance (opening it on the
 * first call), or `undefined` if the path needs async opening (a `.br`/`.gz` bundle -- use {@link getSharedSigSource}).
 * Throws only if a sync-openable source fails to open.
 */
export function getSharedSigSourceSync(source: string): PackageSignatureSource | undefined {
	const cached = sharedSources.get(source);
	if(cached) {
		return cached;
	}
	if(!isSyncOpenable(source)) {
		return undefined;
	}
	const opened = source.endsWith(SigDbExt) ? SigDatabase.openSync(source) : SigDatabaseSet.openManifestSync(source);
	sharedSources.set(source, opened);
	return opened;
}

/** Open a path-based source once, process-wide (async: also handles `.br`/`.gz` bundles and non-embedded manifests). */
export async function getSharedSigSource(source: string): Promise<PackageSignatureSource | undefined> {
	const cached = sharedSources.get(source);
	if(cached) {
		return cached;
	}
	const opened = source.endsWith('.manifest.json') || source.endsWith('.manifest.json.br')
		? await SigDatabaseSet.openManifest(source)
		: await SigDatabase.open(source);
	const raced = sharedSources.get(source);   // a concurrent opener may have won the race
	if(raced) {
		opened.close();
		return raced;
	}
	sharedSources.set(source, opened);
	return opened;
}

/** Release every shared source (file descriptors + cached dictionaries) and empty the cache. Idempotent. */
export function closeSharedSigSources(): void {
	for(const src of sharedSources.values()) {
		src.close();
	}
	sharedSources.clear();
}

/* -------------------------------------------------------------------------------------------------
 * Verification: re-read a written sharded database from its .br files and check it is self-consistent.
 * ---------------------------------------------------------------------------------------------- */

/** per-shard result of {@link verifyShardedDatabase} */
export interface ShardVerifyResult {
	id:           string;
	packages:     number;
	/** the shard's content hash recomputed from its re-read blobs matches the manifest + file header */
	hashOk:       boolean;
	expectedHash: string;
	actualHash:   string;
}

/** the outcome of {@link verifyShardedDatabase} */
export interface SigDbVerifyReport {
	ok:              boolean;
	/** the shared dictionaries' recomputed hashes all match the manifest */
	dictsOk:         boolean;
	shards:          ShardVerifyResult[];
	/** number of distinct packages routed by the manifest */
	routedPackages:  number;
	/** functions/dependencies decoded during the spot-check without an out-of-range string */
	spotChecked:     number;
	/** required packages (e.g. base R) that were requested but not found */
	missingRequired: string[];
	/** every problem found (empty when `ok`) */
	errors:          string[];
}

/**
 * Re-read a written sharded database from its (compressed) files and check it is internally consistent:
 * every shard's content hash recomputed from its re-read blobs matches both the manifest and the file
 * header; every shared dictionary's hash matches; the manifest routes every package a shard holds; a
 * sample of packages decodes (functions + dependencies) with all string indices in range; and any
 * `requirePackages` (e.g. base R) are present. This is a strong correctness gate: correctness over speed.
 */
export async function verifyShardedDatabase(
	manifestFile: string, opts: SigDbOpenOptions & { requirePackages?: readonly string[], sample?: number } = {}
): Promise<SigDbVerifyReport> {
	const errors: string[] = [];
	const set = await SigDatabaseSet.openManifest(manifestFile, opts);
	const manifest = set.manifest;

	// 1. every shared dictionary hash matches its re-read strings
	let dictsOk = true;
	for(const dref of manifest.dicts ?? []) {
		const strings = set.sharedDictionary(dref.id);
		const actual = dictionaryHash(strings);
		if(strings.length !== dref.strings) {
			dictsOk = false;
			errors.push(`dictionary '${dref.id}': expected ${dref.strings} strings, re-read ${strings.length}`);
		}
		if(actual !== dref.hash) {
			dictsOk = false;
			errors.push(`dictionary '${dref.id}': hash ${actual} != manifest ${dref.hash}`);
		}
	}

	// 2. every shard's content hash, recomputed from its re-read blobs, matches the manifest and the file header
	const shardResults: ShardVerifyResult[] = [];
	for(const { ref, db } of set.allShards()) {
		const blobs = db.allBlobs();
		// shared-dictionary shards are hashed over blobs+pkgs only; self-contained shards over their whole content
		const actual = ref.dict ? shardHash(blobs, db.index.pkgs) : db.contentHash(blobs);
		const headerHash = db.content?.hash;
		const hashOk = actual === ref.hash && (headerHash === undefined || headerHash === ref.hash);
		if(!hashOk) {
			errors.push(`shard '${ref.id}': recomputed hash ${actual} vs manifest ${ref.hash}${headerHash && headerHash !== ref.hash ? ` (header ${headerHash})` : ''}`);
		}
		const packages = Object.keys(db.index.pkgs).length;
		if(packages !== ref.packages) {
			errors.push(`shard '${ref.id}': manifest says ${ref.packages} packages, index has ${packages}`);
		}
		shardResults.push({ id: ref.id, packages, hashOk, expectedHash: ref.hash, actualHash: actual });
	}

	// 3. routing covers every package that any shard holds
	const routed = new Set(set.packageNames());
	for(const { ref, db } of set.allShards()) {
		for(const pkg of Object.keys(db.index.pkgs)) {
			if(!routed.has(pkg)) {
				errors.push(`package '${pkg}' in shard '${ref.id}' is not routed by the manifest`);
			}
		}
	}

	// 4. spot-check: a spread of packages decodes with all string indices resolving to real strings
	const names = [...routed].sort();
	const sample = opts.sample ?? 200;
	const step = Math.max(1, Math.floor(names.length / sample));
	let spotChecked = 0;
	for(let i = 0; i < names.length; i += step) {
		const pkg = names[i];
		const exp = set.lookup(pkg);
		if(!exp) {
			errors.push(`spot-check: lookup('${pkg}') returned nothing though it is routed`);
			continue;
		}
		const fns = set.functions(pkg);
		for(const f of fns ?? []) {
			if(typeof f.name !== 'string' || (f.file !== undefined && typeof f.file !== 'string')) {
				errors.push(`spot-check: '${pkg}' function decoded with a non-string name/file (dictionary index out of range?)`);
				break;
			}
			for(const p of f.signature) {
				if(typeof p.name !== 'string' || (p.default !== undefined && typeof p.default !== 'string')) {
					errors.push(`spot-check: '${pkg}' param decoded with a non-string name/default (dictionary index out of range?)`);
					break;
				}
			}
		}
		for(const d of set.dependencies(pkg) ?? []) {
			if(typeof d.name !== 'string' || (d.constraint !== undefined && typeof d.constraint !== 'string')) {
				errors.push(`spot-check: '${pkg}' dependency decoded with a non-string name/constraint (dictionary index out of range?)`);
				break;
			}
		}
		spotChecked++;
	}

	// 5. required packages (e.g. base R) are present
	const missingRequired = (opts.requirePackages ?? []).filter(p => !routed.has(p));
	for(const p of missingRequired) {
		errors.push(`required package '${p}' is missing`);
	}

	set.close();
	return {
		ok:             errors.length === 0, dictsOk, shards:         shardResults,
		routedPackages: routed.size, spotChecked, missingRequired, errors
	};
}
