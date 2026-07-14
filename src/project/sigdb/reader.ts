/**
 * The read path for the `flowr-sigdb` package database: fast partial readers for a single bundle
 * ({@link SigDatabase}) and a sharded set ({@link SigDatabaseSet}), the process-wide shared-source cache,
 * whole-bundle reading, and the post-write verification gate. This is the surface the package-version plugin
 * uses; the format/codec/writer building blocks live in the sibling `sigdb/*` modules (imported directly).
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { RVersion } from '../../util/r-version';
import { DefaultCranBase, SigDbExt, type LibraryExports, type PkgBlob, type PkgBlobTuple, type SigDb, type SigDbContent, type SigDbPkgMeta } from './schema';
import { dayToMillis, releasesOf, newestVersion, resolveVersion, type VersionRelease } from './version';
import { decodeIndex, readSigDbIndex, type ByteRange, type SigDbIndex } from './index-format';
import { tupleToBlob, decodeFunction, decodeDependencies, deriveLibraryExports, versionFnIndices, type DecodedFunction, type ResolvedDependency } from './decode';
import { isCompressed, parseHeader, sigDbStream, resolveSource, ensurePlain, ensurePlainSync } from './decompress';
import { stripCompressedExt } from './codec';
import { contentHash, dictionaryHash, shardHash } from './hash';
import { readManifestFile, SigDbManifestMagic, type SigDbManifest, type SigDbShardRef } from './manifest';

/** apply one `d` line (`["d", start, payload]`, new newline-blob or legacy `string[]` form) to the dictionary in place */
function applyDictLine(json: string, strings: string[]): void {
	const [, start, payload] = JSON.parse(json) as [string, number, string | string[]];
	const batch = typeof payload === 'string' ? payload.split('\n') : payload;
	for(let k = 0; k < batch.length; k++) {
		strings[start + k] = batch[k];
	}
}

function readDictSection(buf: Buffer, strings: string[]): void {
	let off = 0;
	while(off < buf.length) {
		let nl = buf.indexOf(0x0a, off);
		if(nl < 0) {
			nl = buf.length;
		}
		if(nl > off) {
			applyDictLine(buf.toString('utf8', off, nl), strings);
		}
		off = nl + 1;
	}
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
 * The read interface every package-signature source implements, so a single {@link SigDatabase} and a
 * sharded {@link SigDatabaseSet} are interchangeable. Queries are synchronous; any decompression/caching
 * happens once during `open`.
 */
export interface PackageSignatureSource {
	/** whether the source can resolve the package at all */
	has(pkg: string): boolean;
	/** the export view of a package version (defaults to its latest) */
	lookup(pkg: string, version?: string): LibraryExports | undefined;
	/** rich per-function view (signatures + call graphs) of a package version */
	functions(pkg: string, version?: string): DecodedFunction[] | undefined;
	/** declared dependencies (Depends/Imports/…) of a package version, with version qualifiers */
	dependencies(pkg: string, version?: string): ResolvedDependency[] | undefined;
	/** every package name this source can resolve */
	packageNames(): string[];
	/** whether the package is an R-core / base package (its versions are the R releases it shipped with) */
	isBaseR(pkg: string): boolean;
	/** for a base package, the R versions it was part of core (ascending); `undefined` otherwise */
	coreVersions(pkg: string): RVersion[] | undefined;
	/** the release date of a package version (defaulting to the newest release), or `undefined` if unknown */
	releaseDate(pkg: string, version?: string): Date | undefined;
	/** every known release of a package (version + date), ascending by R-version order */
	releaseDates(pkg: string): VersionRelease[];
	/** the newest version of a package by release date (falling back to the recorded latest) */
	latestVersion(pkg: string): RVersion | undefined;
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

/** a caller-supplied index/dictionary for {@link SigDatabase.openSync} (both derived from the source otherwise) */
export interface OpenSyncOptions {
	index?:   SigDbIndex;
	strings?: string[];
}
/** {@link SigDatabase.openSyncFrom} options: cache settings plus an optional precomputed hash/index/dictionary */
export interface OpenSyncFromOptions extends SigDbOpenOptions, OpenSyncOptions {
	hash?: string;
}

/**
 * Fast, partial reader for a single bundle. `open()`/`openSync()` load the string dictionary + `.idx`
 * once (a single ranged read of the dictionary section -- no full parse), then every query seeks straight
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
	 * Open a plain, seekable `.sigs.ndjson` synchronously. Pass `index` to skip reading the `.idx`,
	 * and `strings` to use an already-loaded shared dictionary instead of the file's own `d` section (for a
	 * blob-only shard). One ranged read loads the dictionary -- no readline overhead.
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
			return cached;
		}
		const blob = this.readBlobAt(this.index.blobs[blobIdx]);
		if(this.blobCache.size >= SigDatabase.BlobCacheCap) {
			const oldest = this.blobCache.keys().next().value;
			if(oldest !== undefined) {
				this.blobCache.delete(oldest);
			}
		}
		this.blobCache.set(blobIdx, blob);
		return blob;
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
		return this.index.blobs.map(range => this.readBlobAt(range));
	}

	/** recompute this bundle's self-contained content hash from its re-read data (matches {@link writeSignatureDb}) */
	public contentHash(blobs = this.allBlobs()): string {
		// use only this bundle's own package metadata, in package-index order -- a shared manifest may hoist a
		// superset of metadata that the self-contained bundle was NOT hashed over
		const meta: Record<string, SigDbPkgMeta> = {};
		for(const pkg of Object.keys(this.index.pkgs)) {
			meta[pkg] = this.index.meta[pkg];
		}
		return contentHash({ strings: this.strings, blobs, pkgs: this.index.pkgs, meta });
	}

	/** whether this bundle actually carries the given version of a package (not just the package) */
	public hasVersion(pkg: string, version: string): boolean {
		return this.blob(pkg)?.versions[version] !== undefined;
	}

	public lookup(pkg: string, version?: string): LibraryExports | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		if(!blob || !meta) {
			return undefined;
		}
		return deriveLibraryExports(this.strings, blob, meta, pkg, version, this.cranBase);
	}

	public functions(pkg: string, version?: string): DecodedFunction[] | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		if(!blob || !meta) {
			return undefined;
		}
		const ver = resolveVersion(blob, meta[0], version);
		const idxs = ver !== undefined ? versionFnIndices(blob, ver) : undefined;
		return idxs?.map(i => decodeFunction(this.strings, blob, i));
	}

	public dependencies(pkg: string, version?: string): ResolvedDependency[] | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		if(!blob || !meta) {
			return undefined;
		}
		const ver = resolveVersion(blob, meta[0], version);
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
	public coreVersions(pkg: string): RVersion[] | undefined {
		if(!this.isBaseR(pkg)) {
			return undefined;
		}
		return Object.keys(this.blob(pkg)?.versions ?? {}).map(RVersion.parseOrZero).sort((a, b) => RVersion.compare(a.str, b.str));
	}

	/** the release date of a package version (defaulting to the newest release), or `undefined` if unknown */
	public releaseDate(pkg: string, version?: string): Date | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		if(!blob || !meta) {
			return undefined;
		}
		const ver = version ?? newestVersion(blob, meta[0]);
		const day = ver !== undefined ? blob.dates[ver] : undefined;
		return day !== undefined ? new Date(dayToMillis(day)) : undefined;
	}

	/** every known release date of a package, in ascending R-version order (empty when no dates were stored) */
	public releaseDates(pkg: string): VersionRelease[] {
		return releasesOf(this.blob(pkg));
	}

	/** the newest version of a package by release date (falling back to the recorded latest, then SemVer order) */
	public latestVersion(pkg: string): RVersion | undefined {
		const blob = this.blob(pkg);
		const meta = this.index.meta[pkg];
		const ver = blob && meta ? newestVersion(blob, meta[0]) : undefined;
		return ver !== undefined ? RVersion.parseOrZero(ver) : undefined;
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

/** current-tier shards are preferred over full-tier ones (smaller/faster) when both can serve a request */
function tierRank(ref: SigDbShardRef): number {
	return ref.tier === 'current' ? 0 : 1;
}

/** options for {@link SigDatabaseSet.openManifest} -- the base cache options plus per-shard enable/disable */
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
 * A transparent, read-only view over several {@link SigDatabase} shards described by a {@link SigDbManifest}.
 * When the manifest embeds each shard's index (the default), `openManifest()` reads only that small file to
 * build the package to shard routing table.
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
	 * Synchronous {@link openManifest} -- needs every shard to embed its index (the default for the bundles
	 * flowR ships). Shards and dictionaries still decompress lazily.
	 */
	public static openManifestSync(manifestFile: string, opts: SigDbSetOpenOptions = {}): SigDatabaseSet {
		const { baseDir, manifest } = SigDatabaseSet.prepManifest(manifestFile, opts);
		const indices = manifest.shards.map(s => {
			if(!s.idx) {
				throw new Error(`openManifestSync needs every shard to embed its index; shard '${s.id}' does not -- use openManifest`);
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

	/** lazily open a shard -- decompressing its `.br` (and its shared dictionary) into the cache on first access */
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
		const dicts = new Set<string>();
		for(const i of need) {
			const d = this.manifest.shards[i].dict;
			if(d) {
				dicts.add(d);
			}
		}
		const shardJobs = [...need].map(i => ensurePlain(resolveSource(this.baseDir, this.manifest.shards[i].path),
			{ cacheDir: this.cacheDir, hash: this.manifest.shards[i].hash, index: this.indices[i] }));
		const dictJobs = [...dicts].map(id => {
			const ref = this.manifest.dicts?.find(d => d.id === id);
			return ref ? ensurePlain(resolveSource(this.baseDir, ref.path), { cacheDir: this.cacheDir, hash: ref.hash, indexless: true }) : Promise.resolve('');
		});
		await Promise.all([...shardJobs, ...dictJobs]);
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

	/** read (once) the blob from the shard with the most complete history -- a `full` or `history` tier if present */
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

	public packageNames(): string[] {
		return [...this.routes.keys()];
	}

	/** open (blocking) and return every shard database with its manifest ref -- used for whole-set verification */
	public allShards(): MountedShard[] {
		return this.manifest.shards.map((ref, i) => ({ ref, db: this.shard(i) }));
	}

	/** load (and cache) a shared dictionary's strings by id -- for verification/inspection */
	public sharedDictionary(id: string): string[] {
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

	public functions(pkg: string, version?: string): DecodedFunction[] | undefined {
		return this.firstOf(pkg, version, db => db.functions(pkg, version));
	}

	public dependencies(pkg: string, version?: string): ResolvedDependency[] | undefined {
		return this.firstOf(pkg, version, db => db.dependencies(pkg, version));
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
	public coreVersions(pkg: string): RVersion[] | undefined {
		if(!this.isBaseR(pkg)) {
			return undefined;
		}
		return Object.keys(this.historyBlob(pkg)?.versions ?? {}).map(RVersion.parseOrZero).sort((a, b) => RVersion.compare(a.str, b.str));
	}

	/** every known release of a package (version + date), ascending -- read once from the most complete shard */
	public releaseDates(pkg: string): VersionRelease[] {
		return releasesOf(this.historyBlob(pkg));
	}

	/** the release date of a package version (defaulting to the newest release), or `undefined` if unknown */
	public releaseDate(pkg: string, version?: string): Date | undefined {
		const blob = this.historyBlob(pkg);
		if(!blob) {
			return undefined;
		}
		const ver = version ?? newestVersion(blob, this.manifest.meta?.[pkg]?.[0] ?? '');
		const day = ver !== undefined ? blob.dates[ver] : undefined;
		return day !== undefined ? new Date(dayToMillis(day)) : undefined;
	}

	/** the newest version of a package by release date (falling back to the recorded latest, then SemVer order) */
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
	}
}

const sharedSources = new Map<string, PackageSignatureSource>();

/** whether a bundle path can be opened synchronously (a plain `.sigs.ndjson` or an index-embedding manifest) */
function isSyncOpenable(source: string): boolean {
	return stripCompressedExt(source).endsWith('.manifest.json') || source.endsWith(SigDbExt);
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
 * Re-read a written sharded database from its (compressed) files and check it is internally consistent:
 * every shard's content hash recomputed from its re-read blobs matches both the manifest and the file
 * header; every shared dictionary's hash matches; the manifest routes every package a shard holds; a
 * sample of packages decodes (functions + dependencies) with all string indices in range; and any
 * `requirePackages` (e.g. base R) are present. This is a strong correctness gate: correctness over speed.
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
