/**
 * The read path for the `flowr-sigdb` package database: fast partial readers for a single bundle ({@link SigDatabase})
 * and a sharded set ({@link SigDatabaseSet}), the shared-source cache, whole-bundle reading, and the verification gate.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { RVersion, type VersionString } from '../../util/r-version';
import { DefaultCranBase, FnProp, SigDbExt, type LibraryExports, type PkgBlob, type PkgBlobTuple, type SigClassInfo, type SigDb, type SigDbContent, type SigDbPkgMeta, type SigDbPkgMetaIndex } from './schema';
import { dayToMillis, releasesOf, newestVersion, resolveVersion, type VersionRelease } from './sigdb-version';
import { decodeIndex, readSigDbIndex, type ByteRange, type SigDbIndex } from './index-format';
import { tupleToBlob, decodeFunction, decodeDependencies, decodeClasses, deriveLibraryExports, versionFnIndices, transitiveCallees, type DecodedFunction, type ResolvedDependency } from './decode';
import { isCompressed, isUnpacked, parseHeader, sigDbStream, resolveSource, ensurePlain, ensurePlainSync } from './decompress';
import { stripCompressedExt } from './codec';
import { SigDict } from './dict';
import { contentHash, dictionaryHash, shardHash } from './hash';
import { readManifestFile, SigDbManifestMagic, type SigDbManifest, type SigDbShardRef } from './manifest';
import { uniqueArray } from '../../util/collections/arrays';

/** the run of names one `d` line (`["d", start, payload]`, newline-blob or legacy `string[]` form) adds */
function dictLineRun(json: string): { start: number, names: string } {
	const [, start, payload] = JSON.parse(json) as [string, number, string | string[]];
	return { start, names: typeof payload === 'string' ? payload : payload.join('\n') };
}

/** apply one `d` line to a plain array, for the whole-file form {@link readSigDbFile} reads */
function applyDictLine(json: string, strings: string[]): void {
	const { start, names } = dictLineRun(json);
	const batch = names.split('\n');
	for(let k = 0; k < batch.length; k++) {
		strings[start + k] = batch[k];
	}
}

/**
 * Dictionary ids grouped by first byte and byte length, kept per dictionary rather than per reader (the shards of one
 * database read the same one). One `Int32Array` per group, ascending, so a lookup answers what `indexOf` would while
 * comparing a few hundred names rather than the 1.4 million a scan of the whole dictionary walks.
 */
const dictionaryBuckets = new WeakMap<SigDict, Map<number, Int32Array>>();

/** the id `strings.indexOf(name)` would give, through {@link dictionaryBuckets}; `-1` when the dictionary lacks it */
function dictionaryIdOf(strings: SigDict, name: string): number {
	let buckets = dictionaryBuckets.get(strings);
	if(buckets === undefined) {
		/* one pass over the 1.4 million entries: sizing them first meant walking all of them twice and a map
		   lookup per entry to know where in its group the next one goes */
		const grouped = new Map<number, number[]>();
		for(let i = 0; i < strings.length; i++) {
			const key = strings.groupOf(i);
			const group = grouped.get(key);
			if(group === undefined) {
				grouped.set(key, [i]);
			} else {
				group.push(i);
			}
		}
		buckets = new Map();
		for(const [key, group] of grouped) {
			buckets.set(key, Int32Array.from(group));
		}
		dictionaryBuckets.set(strings, buckets);
	}
	const bucket = buckets.get(SigDict.keyOf(name));
	/* ascending, so the first match is the one a scan from the front would have found */
	for(const id of bucket ?? []) {
		if(strings.at(id) === name) {
			return id;
		}
	}
	return -1;
}

/** the dictionary a bundle's `d` lines spell out */
function readDictSection(buf: Buffer): SigDict {
	const runs: { start: number, names: string }[] = [];
	let off = 0;
	while(off < buf.length) {
		let nl = buf.indexOf(0x0a, off);
		if(nl < 0) {
			nl = buf.length;
		}
		if(nl > off) {
			runs.push(dictLineRun(buf.toString('utf8', off, nl)));
		}
		off = nl + 1;
	}
	return SigDict.ofRuns(runs);
}

/** stream-read a whole bundle into a {@link SigDb} (any size; never one string). Prefer {@link SigDatabase} for partial access. */
export async function readSignatureDb(file: string): Promise<SigDb> {
	const rl = readline.createInterface({ input: sigDbStream(file), crlfDelay: Infinity });
	let header: Record<string, unknown> | undefined;
	const strings: string[] = [];
	const blobs: PkgBlob[] = [];
	const pkgs: Record<string, number> = {};
	const meta: SigDbPkgMetaIndex = {};
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
			applyDictLine(line, strings);
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

/**
 * The read interface every package-signature source implements, so a {@link SigDatabase} and a sharded {@link SigDatabaseSet}
 * are interchangeable. An omitted `version` answers for the database's newest, never the version flowR assumed for the project.
 */
export interface PackageSignatureSource {
	/** whether the source can resolve the package at all */
	has(pkg: string): boolean;
	/** whether the source actually carries the given version of a package (not just the package itself) */
	hasVersion(pkg: string, version: string): boolean;
	/** whether a version is a current CRAN release (i.e. not in the package's `noncran`/removed set) */
	isCranVersion(pkg: string, version: string): boolean;
	/** the repository a version came from, `undefined` in bundles that record none */
	sourceOf(pkg: string, version: string): string | undefined;
	/** The export view of a package version; `version` defaults to the database's newest if omitted. */
	lookup(pkg: string, version?: string): LibraryExports | undefined;
	/**
	 * The packages exporting `name`, ordered by downloads (descending, ties by name); answered without a reverse
	 * index, since a name the database never stores is rejected outright and only blobs that may hold it are decoded.
	 */
	packagesExporting(name: string): readonly string[];
	/**
	 * The package OWNING class `className` (S3: {@link LibraryExports.s3Classes}; S4: {@link LibraryExports.s4Classes};
	 * S3 wins ties). With a `version`, every candidate package is scanned at it instead of using the cached reverse index.
	 */
	classOwner(className: string, version?: string): string | undefined;
	/** Rich per-function view (signatures and call graphs) of a package version; `version` defaults to the newest. */
	functions(pkg: string, version?: string): DecodedFunction[] | undefined;
	/** The rich view of a single named function, decoding only it (unlike {@link functions}); `version` defaults to the newest. */
	functionByName(pkg: string, name: string, version?: string): DecodedFunction | undefined;
	/** Transitive callees of a function within one package version, expanding the stored local call graphs; `version` defaults to the newest. */
	transitiveCallees(pkg: string, name: string, version?: string): string[] | undefined;
	/** Declared dependencies (Depends, Imports, ...) of a package version, with version qualifiers; `version` defaults to the newest. */
	dependencies(pkg: string, version?: string): ResolvedDependency[] | undefined;
	/**
	 * The classes a package version declares and the relations between them (superclasses, slot types, virtual,
	 * union) -- {@link LibraryExports.s4Classes}, a flat name list, has nowhere to hang this; `version` defaults to the newest.
	 */
	classes(pkg: string, version?: string): SigClassInfo[] | undefined;
	/** every package name this source can resolve */
	packageNames(): string[];
	/** whether the package is an R-core / base package (its versions are the R releases it shipped with) */
	isBaseR(pkg: string): boolean;
	/** how often the package was downloaded when the database was built, the popularity {@link SigDbPkgMeta} records */
	downloads(pkg: string): number;
	/** for a base package, the R versions it was part of core (ascending); `undefined` otherwise */
	coreVersions(pkg: string): RVersion[] | undefined;
	/**
	 * The release date of a package version, `undefined` if unknown. Omitted, `version` defaults to the newest
	 * release *by recorded date* (unlike the queries above, which default to the package's recorded latest).
	 */
	releaseDate(pkg: string, version?: string): Date | undefined;
	/** every known release of a package (version + date), ascending by R-version order */
	releaseDates(pkg: string): VersionRelease[];
	/** the newest version of a package by release date (falling back to the recorded latest, then SemVer order) */
	latestVersion(pkg: string): RVersion | undefined;
	/** release any held file handles */
	close(): void;
}

/** one version a source can answer for a package, with its release date when known */
export interface AvailableVersion {
	readonly version: VersionString;
	readonly date?:   Date;
}

/** the on-demand load state of one shard of a {@link SigDatabaseSet} */
export interface ShardStatus {
	/** the shard id, e.g. `current-top` (its `base`/`current`/`history` prefix is the scope it belongs to) */
	readonly id:         string;
	/** whether the shard ships only as a compressed `.br`/`.zst` bundle (so it must be unpacked to be read) */
	readonly compressed: boolean;
	/** whether this session has opened (mounted) the shard */
	readonly accessed:   boolean;
	/** whether the shard's decompressed cache exists on disk (unpacked, this session or an earlier one) */
	readonly unpacked:   boolean;
}

/**
 * The versions a source can answer for a package (dated releases, base-R core releases, and the recorded latest),
 * deduplicated and ascending; the single enumeration both the signature query and the version-guessing query build on.
 */
export function availableVersionEntries(src: PackageSignatureSource, pkg: string): AvailableVersion[] {
	const map = new Map<string, Date | undefined>();
	for(const r of src.releaseDates(pkg)) {
		if(!map.has(r.version.str)) {
			map.set(r.version.str, r.date);
		}
	}
	for(const v of src.coreVersions(pkg) ?? []) {
		if(!map.has(v.str)) {
			map.set(v.str, src.releaseDate(pkg, v.str));
		}
	}
	const latest = src.latestVersion(pkg);
	if(latest && !map.has(latest.str)) {
		map.set(latest.str, src.releaseDate(pkg, latest.str));
	}
	return [...map.entries()]
		.map(([version, date]) => ({ version, ...(date ? { date } : {}) }))
		// versions that differ in writing but not in R-version order (`1.2` vs `1.2.0`) are settled by release date
		.sort((a, b) => RVersion.compare(a.version, b.version) || (a.date && b.date ? a.date.getTime() - b.date.getTime() : 0));
}

/**
 * The reverse index `class -> owning package` over `candidates`, at each one's latest version (S3 indexed first, a
 * stronger signal than S4); the targeted counterpart of {@link PackageSignatureSource.classOwner}.
 */
export function classOwnerIndexFor(src: PackageSignatureSource, candidates: Iterable<string>): Map<string, string> {
	const index = new Map<string, string>();
	const libs: { pkg: string, lib: LibraryExports | undefined }[] = [];
	for(const pkg of candidates) {
		if(src.has(pkg)) {
			libs.push({ pkg, lib: src.lookup(pkg) });
		}
	}
	for(const pick of [(l: LibraryExports | undefined) => l?.s3Classes, (l: LibraryExports | undefined) => l?.s4Classes]) {
		for(const { pkg, lib } of libs) {
			for(const cls of pick(lib) ?? []) {
				if(!index.has(cls)) {
					index.set(cls, pkg);
				}
			}
		}
	}
	return index;
}

/** the package owning `className` at a specific version (linear scan; S3 and S4 both count) */
function classOwnerAtVersion(src: PackageSignatureSource, className: string, version: string): string | undefined {
	return src.packageNames().find(pkg => {
		const lib = src.lookup(pkg, version);
		return (lib?.s3Classes.includes(className) ?? false) || (lib?.s4Classes.includes(className) ?? false);
	});
}

/**
 * Every package any of `sources` states exports `name`, most-downloaded first and ties broken by name.
 * The shared tail of the fan-out sources, which differ only in where their sub-sources come from.
 */
function packagesExportingAcross(name: string, downloads: (pkg: string) => number, sources: Iterable<PackageSignatureSource | undefined>): readonly string[] {
	const found = new Set<string>();
	for(const source of sources) {
		for(const pkg of source?.packagesExporting(name) ?? []) {
			found.add(pkg);
		}
	}
	return [...found].sort((a, b) => downloads(b) - downloads(a) || a.localeCompare(b));
}

/** union view over multiple sources for the same package; routes queries to the appropriate source */
export class MergedSignatureSource implements PackageSignatureSource {
	public constructor(private readonly sources: readonly PackageSignatureSource[]) {}

	/** source carrying a version, or the one with the newest release when unpinned */
	private pick(pkg: string, version: string | undefined): PackageSignatureSource | undefined {
		if(version !== undefined) {
			return this.sources.find(s => s.hasVersion(pkg, version));
		}
		let best: RVersion | undefined, bestSource: PackageSignatureSource | undefined;
		for(const s of this.sources) {
			const latest = s.has(pkg) ? s.latestVersion(pkg) : undefined;
			if(latest && (best === undefined || RVersion.compare(latest.str, best.str) > 0)) {
				best = latest;
				bestSource = s;
			}
		}
		return bestSource ?? this.sources.find(s => s.has(pkg));
	}

	public has(pkg: string): boolean {
		return this.sources.some(s => s.has(pkg));
	}
	public hasVersion(pkg: string, version: string): boolean {
		return this.sources.some(s => s.hasVersion(pkg, version));
	}
	public isCranVersion(pkg: string, version: string): boolean {
		return this.pick(pkg, version)?.isCranVersion(pkg, version) ?? false;
	}
	public sourceOf(pkg: string, version: string): string | undefined {
		return this.pick(pkg, version)?.sourceOf(pkg, version);
	}
	public lookup(pkg: string, version?: string): LibraryExports | undefined {
		return this.pick(pkg, version)?.lookup(pkg, version);
	}
	public packagesExporting(name: string): readonly string[] {
		return packagesExportingAcross(name, pkg => this.downloads(pkg), this.sources);
	}
	public classOwner(className: string, version?: string): string | undefined {
		for(const s of this.sources) {
			const owner = s.classOwner(className, version);
			if(owner !== undefined) {
				return owner;
			}
		}
		return undefined;
	}
	public functions(pkg: string, version?: string): DecodedFunction[] | undefined {
		return this.pick(pkg, version)?.functions(pkg, version);
	}
	public functionByName(pkg: string, name: string, version?: string): DecodedFunction | undefined {
		return this.pick(pkg, version)?.functionByName(pkg, name, version);
	}
	public transitiveCallees(pkg: string, name: string, version?: string): string[] | undefined {
		return this.pick(pkg, version)?.transitiveCallees(pkg, name, version);
	}
	public dependencies(pkg: string, version?: string): ResolvedDependency[] | undefined {
		return this.pick(pkg, version)?.dependencies(pkg, version);
	}
	public classes(pkg: string, version?: string): SigClassInfo[] | undefined {
		return this.pick(pkg, version)?.classes(pkg, version);
	}
	public packageNames(): string[] {
		return uniqueArray(this.sources.flatMap(s => s.packageNames()));
	}
	public isBaseR(pkg: string): boolean {
		return this.sources.some(s => s.has(pkg) && s.isBaseR(pkg));
	}
	public downloads(pkg: string): number {
		return Math.max(0, ...this.sources.map(s => s.downloads(pkg)));
	}
	public coreVersions(pkg: string): RVersion[] | undefined {
		return this.sources.find(s => s.has(pkg))?.coreVersions(pkg);
	}
	public releaseDate(pkg: string, version?: string): Date | undefined {
		return this.pick(pkg, version)?.releaseDate(pkg, version);
	}
	public releaseDates(pkg: string): VersionRelease[] {
		const map = new Map<string, VersionRelease>();
		for(const s of this.sources) {
			for(const r of s.releaseDates(pkg)) {
				if(!map.has(r.version.str)) {
					map.set(r.version.str, r);
				}
			}
		}
		return [...map.values()].sort((a, b) => RVersion.compare(a.version.str, b.version.str));
	}
	public latestVersion(pkg: string): RVersion | undefined {
		let best: RVersion | undefined;
		for(const s of this.sources) {
			const latest = s.latestVersion(pkg);
			if(latest && (best === undefined || RVersion.compare(latest.str, best.str) > 0)) {
				best = latest;
			}
		}
		return best;
	}
	// merged view owns no handles; underlying sources keep theirs
	public close(): void {}
}

/** source that answers for pkg, merging all sources that carry it; undefined if none do */
export function sourceForPackage(sources: readonly PackageSignatureSource[], pkg: string): PackageSignatureSource | undefined {
	const having = sources.filter(s => s.has(pkg));
	return having.length === 0 ? undefined : having.length === 1 ? having[0] : new MergedSignatureSource(having);
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

/** a caller-supplied index/dictionary for {@link SigDatabase.openSync} (both derived from the source otherwise) */
export interface OpenSyncOptions {
	index?:   SigDbIndex;
	strings?: SigDict;
}
/** {@link SigDatabase.openSyncFrom} options: cache settings plus an optional precomputed hash/index/dictionary */
export interface OpenSyncFromOptions extends SigDbOpenOptions, OpenSyncOptions {
	hash?: string;
}

/** the {@link SigDatabase.fd} of a database that has no file behind it (see {@link SigDatabase.fromMemory}) */
const NoFile = -1;

/**
 * One budget for every open bundle, spent in the bytes the blobs take on disk. Per bundle it would not bound
 * anything: how many shards a query set opens is not something the caller picks, and each would claim the
 * budget again. A count would not bound anything either -- one package's blob outweighs a hundred small ones.
 */
let blobCacheBudget = 16 * 1024 * 1024;

/** Sets how many bytes of decoded blobs all open bundles may hold together (`solver.sigdb.blobCacheBudgetMb`). */
export function setBlobCacheBudget(bytes: number): void {
	blobCacheBudget = Math.max(0, bytes);
}

/** one decoded blob a bundle holds, as the shared budget accounts for it */
interface CachedBlob {
	readonly db:      SigDatabase;
	readonly blobIdx: number;
	readonly bytes:   number;
	/** read again since the hand last passed it, so it survives this round (see {@link keepBlob}) */
	used:             boolean;
}

/** what every open bundle holds decoded, so the budget is spent across all of them */
const cachedBlobs: CachedBlob[] = [];
/** where {@link keepBlob} resumes looking for something to drop */
let hand = 0;
let cachedBlobBytes = 0;

/**
 * Keep `blob` decoded for `db`, dropping blobs until all of them fit the budget (age gated).
 */
function keepBlob(db: SigDatabase, blobIdx: number, bytes: number): CachedBlob {
	while(cachedBlobBytes + bytes > blobCacheBudget && cachedBlobs.length > 0) {
		if(hand >= cachedBlobs.length) {
			hand = 0;
		}
		const candidate = cachedBlobs[hand];
		if(candidate.used) {
			candidate.used = false;
			hand++;
			continue;
		}
		cachedBlobs.splice(hand, 1);
		cachedBlobBytes -= candidate.bytes;
		candidate.db.dropBlob(candidate.blobIdx);
	}
	const entry = { db, blobIdx, bytes, used: true };
	cachedBlobs.push(entry);
	cachedBlobBytes += bytes;
	return entry;
}

/** Mark `entry` read, so the hand passes over it once before dropping it. */
function touchBlob(entry: CachedBlob): void {
	entry.used = true;
}

/** give back what `db` held, so a closed bundle stops spending the budget of the open ones */
function releaseBlobs(db: SigDatabase): void {
	for(let i = cachedBlobs.length - 1; i >= 0; i--) {
		if(cachedBlobs[i].db === db) {
			cachedBlobBytes -= cachedBlobs[i].bytes;
			cachedBlobs.splice(i, 1);
		}
	}
	hand = 0;
}

/** the function records of one package version, as {@link SigDatabase.versionFns} keeps them */
interface VersionFns {
	readonly idxs: readonly number[];
	byName?:       ReadonlyMap<string, number>;
}

/**
 * Fast, partial reader for a single bundle. `open()`/`openSync()` load the string dictionary + `.idx` once, then every
 * query seeks straight to one package blob; `open()` additionally decompresses a `.br`/`.gz` source into a hash-keyed cache.
 */
export class SigDatabase implements PackageSignatureSource {
	private closed = false;
	/** parsed blobs by blob index so repeated lookups skip the re-read + JSON.parse; bounded by {@link setBlobCacheBudget|the shared budget} */
	private readonly blobCache = new Map<number, { blob: PkgBlob, entry?: CachedBlob }>();
	/** a version's function indices plus its `name -> index` view, keyed by package and version; FIFO-bounded */
	private readonly versionFnCache = new Map<string, VersionFns>();
	private static readonly VersionFnCacheCap = 2048;
	/** which names a package can offer at all, as sorted dictionary ids; filled the first time its blob is read */
	private readonly nameIdsOfBlob = new Map<number, Int32Array>();
	/** dictionary id per name asked for, so only the names someone actually queried are ever resolved */
	private readonly nameIds = new Map<string, number>();
	/** reverse index `S3 class -> owning package`, over every package's latest version; built once (see {@link classOwner}) */
	private classIndex:        Map<string, string> | undefined;
	private readonly fd:       number;
	readonly strings:          SigDict;
	readonly index:            SigDbIndex;
	readonly content:          SigDbContent | undefined;
	private readonly cranBase: string;
	private constructor(fd: number, strings: SigDict, index: SigDbIndex, content: SigDbContent | undefined, cranBase: string) {
		this.fd = fd;
		this.strings = strings;
		this.index = index;
		this.content = content;
		this.cranBase = cranBase;
	}

	/** Use an already-built {@link SigDb} directly, no file involved: its blobs start out in the cache, so a test needs only {@link SigDbBuilder} plus this. */
	public static fromMemory(db: SigDb): SigDatabase {
		const index: SigDbIndex = { byteCount: 0, dict: [0, 0], blobs: [], pkgs: db.pkgs, meta: db.meta };
		const source = new SigDatabase(NoFile, SigDict.of(db.strings), index, db.content, db.cranBase ?? DefaultCranBase);
		db.blobs.forEach((blob, i) => source.blobCache.set(i, { blob }));
		return source;
	}

	/**
	 * Open a plain, seekable `.sigs.ndjson` synchronously (one ranged read, no readline overhead). Pass `index` to
	 * skip reading the `.idx`, and `strings` to use an already-loaded shared dictionary (for a blob-only shard).
	 */
	public static openSync(plainFile: string, opts: OpenSyncOptions = {}): SigDatabase {
		if(isCompressed(plainFile)) {
			throw new Error('SigDatabase.openSync needs the plain .sigs.ndjson; use open() for .br/.zst/.gz');
		}
		const index = opts.index ?? readSigDbIndex(plainFile);
		const fd = fs.openSync(plainFile, 'r');
		const head = Buffer.allocUnsafe(Math.min(65536, index.byteCount));
		fs.readSync(fd, head, 0, head.length, 0);
		const header = parseHeader(head.toString('utf8'));
		let strings = opts.strings;
		if(strings === undefined) {
			const [dictStart, dictBytes] = index.dict;
			if(dictBytes > 0) {
				const buf = Buffer.allocUnsafe(dictBytes);
				fs.readSync(fd, buf, 0, dictBytes, dictStart);
				strings = readDictSection(buf);
			} else {
				strings = SigDict.of([]);
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
	public static openSyncFrom(source: string, opts: OpenSyncFromOptions): SigDatabase {
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
			if(cached.entry !== undefined) {
				touchBlob(cached.entry);
			}
			return cached.blob;
		}
		if(this.fd === NoFile) {
			return undefined;   // an in-memory database starts out with every blob cached
		}
		const range = this.index.blobs[blobIdx];
		const blob = this.readBlobAt(range);
		if(!this.nameIdsOfBlob.has(blobIdx)) {
			this.nameIdsOfBlob.set(blobIdx, Int32Array.from(new Set(blob.fns.map(fn => fn[0]))).sort());
		}
		this.blobCache.set(blobIdx, { blob, entry: keepBlob(this, blobIdx, range[1]) });
		return blob;
	}

	/** the dictionary id of `name`, or `-1` if the dictionary does not hold it, so no package can offer it */
	private nameId(name: string): number {
		let id = this.nameIds.get(name);
		if(id === undefined) {
			this.nameIds.set(name, id = dictionaryIdOf(this.strings, name));
		}
		return id;
	}

	/**
	 * Whether `pkg` can offer `name` in any of its versions, answered from {@link nameIdsOfBlob} alone; `true` whenever
	 * nothing is known about the package yet, so this only ever skips work that would have found nothing.
	 */
	private mayOffer(pkg: string, name: string): boolean {
		const blobIdx = this.index.pkgs[pkg];
		const ids = blobIdx === undefined ? undefined : this.nameIdsOfBlob.get(blobIdx);
		if(ids === undefined) {
			return true;
		}
		const id = this.nameId(name);
		if(id < 0) {
			return false;
		}
		let lo = 0, hi = ids.length - 1;
		while(lo <= hi) {
			const mid = (lo + hi) >> 1;
			if(ids[mid] === id) {
				return true;
			} else if(ids[mid] < id) {
				lo = mid + 1;
			} else {
				hi = mid - 1;
			}
		}
		return false;
	}

	/** drop one decoded blob, for the shared budget to reclaim what it costs (see {@link keepBlob}) */
	public dropBlob(blobIdx: number): void {
		this.blobCache.delete(blobIdx);
	}

	/** store `value` under `key`, dropping the oldest entry first once the cache sits at `cap` */
	private static cache<K, V>(cache: Map<K, V>, key: K, value: V, cap: number): V {
		if(cache.size >= cap) {
			const oldest = cache.keys().next().value;
			if(oldest !== undefined) {
				cache.delete(oldest);
			}
		}
		cache.set(key, value);
		return value;
	}

	/** seek to a byte range, read + decode the package blob there (no caching) */
	private readBlobAt([start, bytes]: ByteRange): PkgBlob {
		const buf = Buffer.allocUnsafe(bytes);
		fs.readSync(this.fd, buf, 0, bytes, start);
		const [, , tuple] = JSON.parse(buf.toString('utf8')) as [string, number, PkgBlobTuple];
		return tupleToBlob(tuple);
	}

	/** read every unique package blob in index order (used to re-hash a whole shard during verification) */
	public allBlobs(): PkgBlob[] {
		// an in-memory database has no byte ranges to re-read: its blobs are the cached ones, in blob-index order
		return this.fd === NoFile
			? [...this.blobCache.entries()].sort(([a], [b]) => a - b).map(([, { blob }]) => blob)
			: this.index.blobs.map(range => this.readBlobAt(range));
	}

	/** recompute this bundle's self-contained content hash from its re-read data (matches {@link writeSignatureDb}) */
	public contentHash(blobs = this.allBlobs()): string {
		// only this bundle's own metadata: a shared manifest may hoist a superset it was not hashed over
		const meta: SigDbPkgMetaIndex = {};
		for(const pkg of Object.keys(this.index.pkgs)) {
			meta[pkg] = this.index.meta[pkg];
		}
		return contentHash({ strings: this.strings, blobs, pkgs: this.index.pkgs, meta });
	}

	/** whether this bundle actually carries the given version of a package (not just the package) */
	public hasVersion(pkg: string, version: string): boolean {
		return this.blob(pkg)?.versions[version] !== undefined;
	}

	public isCranVersion(pkg: string, version: string): boolean {
		return !this.blob(pkg)?.noncran?.includes(version);
	}

	public sourceOf(pkg: string, version: string): string | undefined {
		const idx = this.blob(pkg)?.sources?.[version];
		return idx === undefined ? undefined : this.strings.at(idx);
	}

	/** `{ blob, meta }` for `pkg` when this bundle carries both, `undefined` otherwise; the shared prologue of most per-package queries below. */
	private blobMeta(pkg: string): { blob: PkgBlob, meta: SigDbPkgMeta } | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		return blob && meta ? { blob, meta } : undefined;
	}

	public lookup(pkg: string, version?: string): LibraryExports | undefined {
		const bm = this.blobMeta(pkg);
		return bm && deriveLibraryExports(this.strings, bm.blob, bm.meta, pkg, version, this.cranBase);
	}

	public packagesExporting(name: string): readonly string[] {
		const id = this.nameId(name);
		if(id < 0) {
			return [];
		}
		const found: string[] = [];
		for(const pkg in this.index.pkgs) {
			if(this.mayOffer(pkg, name) && this.exportsNameId(pkg, id)) {
				found.push(pkg);
			}
		}
		return found.sort((a, b) => this.downloads(b) - this.downloads(a) || a.localeCompare(b));
	}

	/**
	 * Whether the newest version of `pkg` exports the name with dictionary id `id`. The same answer
	 * {@link lookup}'s `exported` gives, off the function records themselves: asking a package at a time is what
	 * {@link packagesExporting} does, and deriving a whole export view per package to read one name out of it is not
	 * worth the five arrays and the map it builds.
	 */
	private exportsNameId(pkg: string, id: number): boolean {
		const r = this.versionFns(pkg);
		if(r === undefined) {
			return false;
		}
		for(const i of r.fns.idxs) {
			const fn = r.blob.fns[i];
			if(fn[0] === id && (fn[3] & FnProp.Exported) !== 0) {
				return true;
			}
		}
		return false;
	}

	public classOwner(className: string, version?: string): string | undefined {
		if(version !== undefined) {
			return classOwnerAtVersion(this, className, version);
		}
		this.classIndex ??= classOwnerIndexFor(this, this.packageNames());
		return this.classIndex.get(className);
	}

	/**
	 * Resolve a package version to its blob and the function records of that version (the shared prologue of
	 * {@link functions}/{@link functionByName}). The blob comes from {@link blob} every time rather than out of
	 * {@link versionFnCache}: holding one here would keep it decoded past what {@link setBlobCacheBudget|the shared budget} allows.
	 */
	private versionFns(pkg: string, version?: string): { blob: PkgBlob, fns: VersionFns } | undefined {
		const bm = this.blobMeta(pkg);
		if(!bm) {
			return undefined;
		}
		// keyed on the resolved version, so `undefined` and the version it stands for share one entry
		const ver = resolveVersion(bm.blob, bm.meta[0], version);
		if(ver === undefined) {
			return undefined;
		}
		const key = `${pkg}\0${ver}`;
		const cached = this.versionFnCache.get(key);
		if(cached !== undefined) {
			return { blob: bm.blob, fns: cached };
		}
		const idxs = versionFnIndices(bm.blob, ver);
		if(idxs === undefined) {
			return undefined;
		}
		return { blob: bm.blob, fns: SigDatabase.cache(this.versionFnCache, key, { idxs }, SigDatabase.VersionFnCacheCap) };
	}

	public functions(pkg: string, version?: string): DecodedFunction[] | undefined {
		const r = this.versionFns(pkg, version);
		return r?.fns.idxs.map(i => decodeFunction(this.strings, r.blob, i));
	}

	public functionByName(pkg: string, name: string, version?: string): DecodedFunction | undefined {
		if(!this.mayOffer(pkg, name)) {
			return undefined;
		}
		const r = this.versionFns(pkg, version);
		if(r === undefined) {
			return undefined;
		}
		if(r.fns.byName === undefined) {
			const byName = new Map<string, number>();
			for(const i of r.fns.idxs) {
				const fn = this.strings.at(r.blob.fns[i][0]);
				// first record wins, as the linear scan did
				if(!byName.has(fn)) {
					byName.set(fn, i);
				}
			}
			r.fns.byName = byName;
		}
		const hit = r.fns.byName.get(name);
		return hit !== undefined ? decodeFunction(this.strings, r.blob, hit) : undefined;
	}

	public transitiveCallees(pkg: string, name: string, version?: string): string[] | undefined {
		const fns = this.functions(pkg, version);
		return fns?.some(f => f.name === name) ? transitiveCallees(fns, name) : undefined;
	}

	/** What `decode` reads off the blob for the asked version, `undefined` when this source carries neither. */
	private decodedFor<T>(pkg: string, version: string | undefined, decode: (strings: SigDict, blob: Readonly<PkgBlob>, ver: string) => T): T | undefined {
		const bm = this.blobMeta(pkg);
		const ver = bm ? resolveVersion(bm.blob, bm.meta[0], version) : undefined;
		return bm && ver !== undefined ? decode(this.strings, bm.blob, ver) : undefined;
	}

	public dependencies(pkg: string, version?: string): ResolvedDependency[] | undefined {
		return this.decodedFor(pkg, version, decodeDependencies);
	}

	public classes(pkg: string, version?: string): SigClassInfo[] | undefined {
		return this.decodedFor(pkg, version, decodeClasses);
	}

	/** whether this is an R-core / base package (its versions are the R releases it shipped with; see {@link SigDbPkgMeta}) */
	public isBaseR(pkg: string): boolean {
		return this.index.meta[pkg]?.[3] === 1;
	}

	/** the download count recorded for the package, `0` when this source does not carry it */
	public downloads(pkg: string): number {
		return this.index.meta[pkg]?.[2] ?? 0;
	}

	/** the R versions a base package was part of core, ascending (exactly its stored versions); `undefined` for a non-base package */
	public coreVersions(pkg: string): RVersion[] | undefined {
		if(!this.isBaseR(pkg)) {
			return undefined;
		}
		return Object.keys(this.blob(pkg)?.versions ?? {}).map(RVersion.parseOrZero).sort((a, b) => RVersion.compare(a.str, b.str));
	}

	/** the release date of a package version (defaulting to the newest release), or `undefined` if unknown */
	public releaseDate(pkg: string, version?: string): Date | undefined {
		const bm = this.blobMeta(pkg);
		if(!bm) {
			return undefined;
		}
		const ver = version ?? newestVersion(bm.blob, bm.meta[0]);
		const day = ver !== undefined ? bm.blob.dates[ver] : undefined;
		return day !== undefined ? new Date(dayToMillis(day)) : undefined;
	}

	/** every known release date of a package, in ascending R-version order (empty when no dates were stored) */
	public releaseDates(pkg: string): VersionRelease[] {
		return releasesOf(this.blob(pkg));
	}

	/** the newest version of a package by release date (falling back to the recorded latest, then SemVer order) */
	public latestVersion(pkg: string): RVersion | undefined {
		const bm = this.blobMeta(pkg);
		const ver = bm ? newestVersion(bm.blob, bm.meta[0]) : undefined;
		return ver !== undefined ? RVersion.parseOrZero(ver) : undefined;
	}

	/** close the underlying file descriptor (idempotent; safe to call more than once) */
	public close(): void {
		if(!this.closed) {
			this.closed = true;
			releaseBlobs(this);
			this.blobCache.clear();
			this.versionFnCache.clear();
			this.classIndex = undefined;
			if(this.fd !== NoFile) {
				fs.closeSync(this.fd);
			}
		}
	}
}

/** current-tier shards are preferred over full-tier ones (smaller/faster) when both can serve a request */
function tierRank(ref: SigDbShardRef): number {
	return ref.tier === 'current' ? 0 : 1;
}

/** options for {@link SigDatabaseSet.openManifest}: the base cache options plus per-shard enable/disable */
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

/** a resolved manifest: the directory its shard paths are relative to, plus the parsed manifest itself */
interface PreparedManifest {
	baseDir:  string;
	manifest: SigDbManifest;
}
/** one mounted shard: its manifest entry paired with the opened {@link SigDatabase} */
interface MountedShard {
	ref: SigDbShardRef;
	db:  SigDatabase;
}

/**
 * A transparent, read-only view over several {@link SigDatabase} shards described by a {@link SigDbManifest}. When the
 * manifest embeds each shard's index (the default), `openManifest()` reads only that small file to build the routing table.
 */
export class SigDatabaseSet implements PackageSignatureSource {
	private readonly opened:    (SigDatabase | undefined)[];
	readonly manifest:          SigDbManifest;
	/** the directory the manifest's shard/dict paths are relative to */
	readonly baseDir:           string;
	private readonly indices:   SigDbIndex[];
	/** package name to shard indices, ordered by preference (current before full) */
	private readonly routes:    Map<string, number[]>;
	private readonly cacheDir?: string;
	/** see {@link SigDatabase.classIndex} */
	private classIndex:         Map<string, string> | undefined;

	private constructor(manifest: SigDbManifest, baseDir: string, indices: SigDbIndex[], routes: Map<string, number[]>, cacheDir?: string) {
		this.manifest = manifest;
		this.baseDir = baseDir;
		this.indices = indices;
		this.routes = routes;
		this.cacheDir = cacheDir;
		this.opened = new Array<SigDatabase | undefined>(manifest.shards.length).fill(undefined);
	}

	/** read + validate a manifest and apply the include/exclude shard filter */
	private static prepManifest(manifestFile: string, opts: SigDbSetOpenOptions): PreparedManifest {
		const baseDir = path.dirname(manifestFile);
		const full = readManifestFile(manifestFile);
		if(full.format !== SigDbManifestMagic) {
			throw new Error(`not a ${SigDbManifestMagic} (got ${String(full.format)})`);
		}
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
		// prefer the embedded (compact) index with hoisted meta
		const indices = await Promise.all(manifest.shards.map(async s =>
			s.idx ? decodeIndex(s.idx, manifest.meta) : readSigDbIndex(await ensurePlain(resolveSource(baseDir, s.path), { cacheDir: opts.cacheDir, hash: s.hash }))));
		return SigDatabaseSet.assemble(manifest, baseDir, indices, opts.cacheDir);
	}

	/**
	 * Synchronous {@link openManifest}, needing every shard to embed its index (the default for the bundles
	 * flowR ships). Shards and dictionaries still decompress lazily.
	 */
	public static openManifestSync(manifestFile: string, opts: SigDbSetOpenOptions = {}): SigDatabaseSet {
		const { baseDir, manifest } = SigDatabaseSet.prepManifest(manifestFile, opts);
		const indices = manifest.shards.map(s => {
			if(!s.idx) {
				throw new Error(`openManifestSync needs every shard to embed its index; shard '${s.id}' does not, use openManifest`);
			}
			return decodeIndex(s.idx, manifest.meta);
		});
		return SigDatabaseSet.assemble(manifest, baseDir, indices, opts.cacheDir);
	}

	/** shared dictionaries, loaded (decompressed + parsed) once and cached by id */
	private readonly dictCache = new Map<string, SigDict>();

	/** load (and cache) a shared dictionary's strings, decompressing its `.br` into the cache once */
	private dictionaryStrings(dictId: string): SigDict {
		const cached = this.dictCache.get(dictId);
		if(cached) {
			return cached;
		}
		const ref = this.manifest.dicts?.find(d => d.id === dictId);
		if(!ref) {
			throw new Error(`manifest references unknown dictionary '${dictId}'`);
		}
		const plain = ensurePlainSync(resolveSource(this.baseDir, ref.path), { cacheDir: this.cacheDir, hash: ref.hash, indexless: true });
		let strings: SigDict;
		const fd = fs.openSync(plain, 'r');
		try {
			const [start, bytes] = ref.range;
			const buf = Buffer.allocUnsafe(bytes);
			fs.readSync(fd, buf, 0, bytes, start);
			strings = readDictSection(buf);
		} finally {
			fs.closeSync(fd);
		}
		this.dictCache.set(dictId, strings);
		return strings;
	}

	/** lazily open a shard, decompressing its `.br` (and its shared dictionary) into the cache on first access */
	private shard(i: number): SigDatabase {
		const existing = this.opened[i];
		if(existing) {
			return existing;
		}
		const ref = this.manifest.shards[i];
		const strings = ref.dict ? this.dictionaryStrings(ref.dict) : undefined;
		const db = SigDatabase.openSyncFrom(resolveSource(this.baseDir, ref.path),
			{ cacheDir: this.cacheDir, hash: ref.hash, index: this.indices[i], strings });
		this.opened[i] = db;
		return db;
	}

	/**
	 * Warm the shards (and their shared dictionaries) needed for `pkgs`, or **everything** when omitted.
	 * Afterward, the synchronous query methods, for the latest *and* historical versions, do no I/O or decompression.
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
	 * Warm just the shards matching `include`, e.g., only the current-tier top shards (the base + most-downloaded
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
		const dicts = new Set([...need].map(i => this.manifest.shards[i].dict).filter((d): d is string => !!d));
		const shardJobs = [...need].map(i => ensurePlain(resolveSource(this.baseDir, this.manifest.shards[i].path),
			{ cacheDir: this.cacheDir, hash: this.manifest.shards[i].hash, index: this.indices[i] }));
		const dictJobs = [...dicts].map(id => {
			const ref = this.manifest.dicts?.find(d => d.id === id);
			return ref ? ensurePlain(resolveSource(this.baseDir, ref.path), { cacheDir: this.cacheDir, hash: ref.hash, indexless: true }) : Promise.resolve('');
		});
		await Promise.all([...shardJobs, ...dictJobs]);
		// open each shard now so later synchronous queries never block
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

	/** read (once) the blob from the shard with the most complete history: a `full` or `history` tier if present */
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
	public hasVersion(pkg: string, version: string): boolean {
		return this.route(pkg, version).length > 0;
	}

	public isCranVersion(pkg: string, version: string): boolean {
		return !this.historyBlob(pkg)?.noncran?.includes(version);
	}

	public sourceOf(pkg: string, version: string): string | undefined {
		const shard = this.route(pkg, version)[0] ?? this.routes.get(pkg)?.[0];
		return shard === undefined ? undefined : this.shard(shard).sourceOf(pkg, version);
	}

	public packageNames(): string[] {
		return [...this.routes.keys()];
	}

	/** the on-demand load state (opened + unpacked) of every shard in this set */
	public shardStatus(): ShardStatus[] {
		return this.manifest.shards.map((ref, i) => {
			const compressed = isCompressed(resolveSource(this.baseDir, ref.path));
			return {
				id:       ref.id,
				compressed,
				accessed: this.opened[i] !== undefined,
				unpacked: !compressed || isUnpacked(ref.hash, this.cacheDir)
			};
		});
	}

	/** open (blocking) and return every shard database with its manifest ref, for whole-set verification */
	public allShards(): MountedShard[] {
		return this.manifest.shards.map((ref, i) => ({ ref, db: this.shard(i) }));
	}

	/** load (and cache) a shared dictionary by id, for verification/inspection */
	public sharedDictionary(id: string): SigDict {
		return this.dictionaryStrings(id);
	}

	/** the first non-empty result from the shards that can serve `pkg` (in preferred order: current before full) */
	private firstOf<T>(pkg: string, version: string | undefined, read: (db: SigDatabase) => T | undefined): T | undefined {
		for(const i of this.route(pkg, version)) {
			const r = read(this.shard(i));
			if(r) {
				return r;
			}
		}
		return undefined;
	}

	public lookup(pkg: string, version?: string): LibraryExports | undefined {
		return this.firstOf(pkg, version, db => db.lookup(pkg, version));
	}

	public packagesExporting(name: string): readonly string[] {
		return packagesExportingAcross(name, pkg => this.downloads(pkg), [...this.indices.keys()].map(idx => this.shard(idx)));
	}

	public classOwner(className: string, version?: string): string | undefined {
		if(version !== undefined) {
			return classOwnerAtVersion(this, className, version);
		}
		this.classIndex ??= classOwnerIndexFor(this, this.packageNames());
		return this.classIndex.get(className);
	}

	public functions(pkg: string, version?: string): DecodedFunction[] | undefined {
		return this.firstOf(pkg, version, db => db.functions(pkg, version));
	}

	public functionByName(pkg: string, name: string, version?: string): DecodedFunction | undefined {
		return this.firstOf(pkg, version, db => db.functionByName(pkg, name, version));
	}

	public transitiveCallees(pkg: string, name: string, version?: string): string[] | undefined {
		const fns = this.functions(pkg, version);
		return fns?.some(f => f.name === name) ? transitiveCallees(fns, name) : undefined;
	}

	public dependencies(pkg: string, version?: string): ResolvedDependency[] | undefined {
		return this.firstOf(pkg, version, db => db.dependencies(pkg, version));
	}

	public classes(pkg: string, version?: string): SigClassInfo[] | undefined {
		return this.firstOf(pkg, version, db => db.classes(pkg, version));
	}

	/** whether this is an R-core / base package (see {@link SigDatabase.isBaseR}); O(1) via the hoisted metadata */
	public isBaseR(pkg: string): boolean {
		const meta = this.manifest.meta?.[pkg];
		if(meta) {
			return meta[3] === 1;
		}
		return this.route(pkg).some(i => this.shard(i).isBaseR(pkg));
	}

	/** the download count of the package; O(1) via the hoisted metadata, so no shard has to be unpacked for it */
	public downloads(pkg: string): number {
		const meta = this.manifest.meta?.[pkg];
		return meta ? meta[2] : Math.max(0, ...this.route(pkg).map(i => this.shard(i).downloads(pkg)));
	}

	public coreVersions(pkg: string): RVersion[] | undefined {
		if(!this.isBaseR(pkg)) {
			return undefined;
		}
		return Object.keys(this.historyBlob(pkg)?.versions ?? {}).map(RVersion.parseOrZero).sort((a, b) => RVersion.compare(a.str, b.str));
	}

	/** every known release of a package (version + date), ascending, read once from the most complete shard */
	public releaseDates(pkg: string): VersionRelease[] {
		return releasesOf(this.historyBlob(pkg));
	}

	public releaseDate(pkg: string, version?: string): Date | undefined {
		const blob = this.historyBlob(pkg);
		if(!blob) {
			return undefined;
		}
		const ver = version ?? newestVersion(blob, this.manifest.meta?.[pkg]?.[0] ?? '');
		const day = ver !== undefined ? blob.dates[ver] : undefined;
		return day !== undefined ? new Date(dayToMillis(day)) : undefined;
	}

	public latestVersion(pkg: string): RVersion | undefined {
		const blob = this.historyBlob(pkg);
		const ver = blob ? newestVersion(blob, this.manifest.meta?.[pkg]?.[0] ?? '') : undefined;
		return ver !== undefined ? RVersion.parseOrZero(ver) : undefined;
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
		this.classIndex = undefined;
	}
}

const sharedSources = new Map<string, PackageSignatureSource>();

/** whether a bundle path can be opened synchronously (a plain `.sigs.ndjson` or an index-embedding manifest) */
function isSyncOpenable(source: string): boolean {
	return stripCompressedExt(source).endsWith('.manifest.json') || source.endsWith(SigDbExt);
}

/**
 * Open a path-based source once, process-wide, synchronously. Returns the shared instance (opening it on the first call), or
 * `undefined` if the path needs async opening (a `.br`/`.gz` bundle, use {@link getSharedSigSource}); throws on any other open failure.
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

/** Open a path-based source once, process-wide (async: also handles `.br`/`.zst`/`.gz` bundles and non-embedded manifests). */
export async function getSharedSigSource(source: string): Promise<PackageSignatureSource | undefined> {
	const cached = sharedSources.get(source);
	if(cached) {
		return cached;
	}
	const opened = stripCompressedExt(source).endsWith('.manifest.json')
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

/** {@link verifyShardedDatabase} options: open settings plus which packages must exist and how many to spot-check */
export interface VerifyOptions extends SigDbOpenOptions {
	requirePackages?: readonly string[];
	sample?:          number;
}

/**
 * Re-read a written sharded database from its (compressed) files and check it is internally consistent: shard and
 * dictionary hashes, routing completeness, a decode spot-check, and any `requirePackages` present. Correctness over speed.
 */
export async function verifyShardedDatabase(
	manifestFile: string, opts: VerifyOptions = {}
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
		/* a class names itself, its superclasses and its slots out of the same dictionary the rest reads from */
		for(const c of set.classes(pkg) ?? []) {
			const strings = [c.name, ...c.supers, ...c.slots.flatMap(slot => [slot.name, slot.type]), c.package];
			if(strings.some(entry => entry !== undefined && typeof entry !== 'string')) {
				errors.push(`spot-check: '${pkg}' class decoded with a non-string name/super/slot (dictionary index out of range?)`);
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
