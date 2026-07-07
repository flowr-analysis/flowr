import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

/*
 * Reader/writer for the `flowr-pkgdb` database (schema 4) produced by crawlr's `dump`.
 * An export list mixes `strings`-pool indices (number) and inline single-use names.
 * latest: pkgs[name] = [version, exported]. all: shares a `lists` pool and stores
 * pkgs[name] = [latest, versions, nonCran?] with each version [ver, exported, internal?, deprecated?].
 * Optional `all` definition locations: a `files` pool + locs[pkg][id] = [fileIndex, line] (latest only).
 * CRAN urls are reconstructed on load. {@link PkgDbBuilder} writes, {@link PkgDatabase} reads - both in flowR.
 */

export const PkgDbMagic = 'flowr-pkgdb';
export const PkgDbSchema = 4;
export const DefaultCranBase = 'https://cran.r-project.org/src/contrib/';

export type PkgDbItem = number | string;
export type PkgDbLatestEntry = [version: string, exported: PkgDbItem[]];
/** one version in the `all` scope: `[version, exported, internal?, deprecated?]` of `lists` indices */
export type PkgDbAllVersion = [string, number] | [string, number, number] | [string, number, number, number];
/** `all`-scope package: `[latest, versions, nonCranVersions?]` (all arrays, no keys) */
export type PkgDbAllEntry = [string, PkgDbAllVersion[]] | [string, PkgDbAllVersion[], string[]];
/** optional definition location `[fileIndex, line]` indexing the `files` pool */
export type PkgDbLoc = readonly [fileIndex: number, line: number];

export interface PkgDbContent {
	version:   number;
	date:      string;
	hash:      string;
	generated: number;
	packages:  number;
	versions:  number;
}
interface PkgDbCommon {
	format:    string;
	schema:    number;
	content:   PkgDbContent;
	cranBase?: string;
	strings:   string[];
	archived?: string[];
	noncran?:  string[];
}
export interface PkgDbLatest extends PkgDbCommon { scope: 'latest', pkgs: Record<string, PkgDbLatestEntry> }
export interface PkgDbAll extends PkgDbCommon {
	scope:  'all',
	lists:  PkgDbItem[][],
	pkgs:   Record<string, PkgDbAllEntry>,
	/** optional file-path pool for {@link locs} */
	files?: string[],
	/** optional definition locations of the latest version: `pkg -> identifier -> [fileIndex, line]` */
	locs?:  Record<string, Record<string, PkgDbLoc>>
}
export type PkgDb = PkgDbLatest | PkgDbAll;

/** a definition location surfaced from the `all` scope when the database carries them */
export interface PkgDbDefinitionLocation { file: string, line: number }

/** the resolved identifiers of one package version */
export interface LibraryExports {
	version:    string;
	exported:   string[];
	/** defined-but-not-exported identifiers (only available in the `all` scope) */
	internal:   string[];
	deprecated: string[];
	cran:       boolean;
	cranUrl?:   string;
	/** definition location per identifier, if the database carries them (`all` scope, latest version) */
	locations?: ReadonlyMap<string, PkgDbDefinitionLocation>;
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

/** Validate the structural invariants of a decoded database, throwing a descriptive error on failure. */
export function validatePkgDb(o: unknown): asserts o is PkgDb {
	const fail = (msg: string): never => {
		throw new Error(`invalid flowr-pkgdb database: ${msg}`);
	};
	if(typeof o !== 'object' || o === null) {
		fail('not an object');
	}
	const db = o as Record<string, unknown>;
	if(db.format !== PkgDbMagic) {
		fail(`missing/invalid format (expected "${PkgDbMagic}")`);
	}
	if(db.schema !== PkgDbSchema) {
		fail(`unsupported schema version ${String(db.schema)} (expected ${PkgDbSchema})`);
	}
	if(db.scope !== 'latest' && db.scope !== 'all') {
		fail(`invalid scope ${String(db.scope)}`);
	}
	if(!Array.isArray(db.strings)) {
		fail('missing strings pool');
	}
	if(typeof db.pkgs !== 'object' || db.pkgs === null) {
		fail('missing pkgs');
	}
	if(db.scope === 'all' && !Array.isArray(db.lists)) {
		fail('all-scope database is missing the lists pool');
	}
	if(typeof db.content !== 'object' || db.content === null || typeof (db.content as PkgDbContent).version !== 'number') {
		fail('missing/invalid content header');
	}
}

/** portable gunzip (Node + browser + VS Code) via the Web Streams API */
async function gunzip(bytes: Uint8Array): Promise<string> {
	return new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

function isGzip(bytes: Uint8Array): boolean {
	return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export type PkgDbScope = 'all' | 'latest' | 'tiny';
/** richest first: `all` carries every version, `latest`/`tiny` only the current one */
const PkgDbScopeOrder: PkgDbScope[] = ['all', 'latest', 'tiny'];

/** layouts a bundled database may sit in, relative to a search root */
const PkgDbSubDirs = ['data/pkgdb', 'src/data/pkgdb', 'dist/src/data/pkgdb'];

/** roots to search for a bundled database; extendable via `$FLOWR_PKGDB_DIR` (path-delimiter separated) */
function pkgDbSearchRoots(extra?: readonly string[]): string[] {
	const roots = [...(extra ?? [])];
	const env = typeof process !== 'undefined' ? process.env?.FLOWR_PKGDB_DIR : undefined;
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
 * Location of a bundled database, found by walking up from several roots (this module,
 * `$FLOWR_PKGDB_DIR`, the working directory) across the dev (`src`) and build (`dist`) layouts. With
 * no `scope` it returns the richest available tier (brotli, then gzip, then plain json). Node only
 * (needs `fs`); pass `searchRoots` to override where it looks.
 */
export function defaultPkgDbPath(scope?: PkgDbScope, searchRoots?: readonly string[]): string | undefined {
	if(typeof fs?.existsSync !== 'function') {
		return undefined;
	}
	const scopes = scope ? [scope] : PkgDbScopeOrder;
	for(const root of pkgDbSearchRoots(searchRoots)) {
		for(let dir = root, i = 0; i < 10; i++) {
			for(const sub of PkgDbSubDirs) {
				for(const s of scopes) {
					for(const suffix of ['.br', '.gz', '']) {
						const candidate = path.join(dir, sub, `pkgdb-${s}.json${suffix}`);
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

/** classified identifiers of one package version, fed to {@link PkgDbBuilder} */
export interface VersionExports {
	exported:   readonly string[];   // real exports: NAMESPACE symbols + S3 methods (generic.class)
	internal:   readonly string[];   // defined-but-not-exported identifiers (kept only in the `all` scope)
	deprecated: readonly string[];   // subset flagged deprecated (kept only in the `all` scope)
	cran:       boolean;
	/** optional definition location per identifier: `name -> [file, line]` (emitted only in the `all` scope) */
	locations?: ReadonlyMap<string, readonly [file: string, line: number]>;
}

interface RawPackage { latest: string, archived: boolean, downloads: number, versions: Map<string, VersionExports> }

/** portable non-cryptographic 64-bit hash (cyrb53), hex, for update detection */
function hash53(str: string): string {
	let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
	for(let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Serializes a {@link PkgDb}. Accumulate per-version exports with {@link addPackage}/{@link addVersion},
 * then {@link build} a scope. The multi-use string pool is computed per scope; the `latest` scope may
 * be pruned to the most-downloaded packages. This is the counterpart of {@link PkgDatabase} (the reader).
 */
export class PkgDbBuilder {
	private readonly raw = new Map<string, RawPackage>();
	private versionCount = 0;

	public addPackage(name: string, opts: { latest: string, archived?: boolean, downloads?: number }): void {
		const p = this.raw.get(name);
		if(p) {
			p.latest = opts.latest;
			p.archived = opts.archived ?? p.archived;
			p.downloads = opts.downloads ?? p.downloads;
		} else {
			this.raw.set(name, { latest: opts.latest, archived: opts.archived ?? false, downloads: opts.downloads ?? 0, versions: new Map() });
		}
	}

	public addVersion(name: string, version: string, exports: VersionExports): void {
		const p = this.raw.get(name) ?? { latest: version, archived: false, downloads: 0, versions: new Map() };
		if(!this.raw.has(name)) {
			this.raw.set(name, p);
		}
		p.versions.set(version, exports);
		this.versionCount++;
	}

	private relevant(scope: 'latest' | 'all', prune: { minDownloads: number, topN?: number }): { name: string, version: string, ex: VersionExports }[] {
		if(scope === 'all') {
			const out: { name: string, version: string, ex: VersionExports }[] = [];
			for(const [name, p] of this.raw) {
				for(const [version, ex] of p.versions) {
					out.push({ name, version, ex });
				}
			}
			return out;
		}
		let pkgs = [...this.raw].filter(([, p]) => p.downloads >= prune.minDownloads && p.versions.has(p.latest));
		if(prune.topN !== undefined && pkgs.length > prune.topN) {
			pkgs = pkgs.sort((a, b) => b[1].downloads - a[1].downloads).slice(0, prune.topN);
		}
		return pkgs.map(([name, p]) => ({ name, version: p.latest, ex: p.versions.get(p.latest) as VersionExports }));
	}

	private buildPool(relevant: { ex: VersionExports }[], scope: 'latest' | 'all'): { strings: string[], index: Map<string, number> } {
		const freq = new Map<string, number>();
		for(const { ex } of relevant) {
			const names = scope === 'all' ? [...ex.exported, ...ex.internal, ...ex.deprecated] : ex.exported;
			for(const name of names) {
				freq.set(name, (freq.get(name) ?? 0) + 1);
			}
		}
		const strings = [...freq.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([n]) => n);
		return { strings, index: new Map(strings.map((n, i) => [n, i])) };
	}

	public build(scope: 'latest' | 'all', meta: { version: number, date: string, generated: number, cranBase?: string, minDownloads?: number, topN?: number }): PkgDb {
		const relevant = this.relevant(scope, { minDownloads: meta.minDownloads ?? 0, topN: meta.topN });
		const { strings, index } = this.buildPool(relevant, scope);
		const encode = (names: readonly string[]): PkgDbItem[] => [...new Set(names)].sort().map(n => index.get(n) ?? n);

		const content: PkgDbContent = {
			version:   meta.version, date:      meta.date, hash:      '', generated: meta.generated,
			packages:  scope === 'latest' ? relevant.length : this.raw.size, versions:  this.versionCount
		};
		const cranBase = meta.cranBase && meta.cranBase !== DefaultCranBase ? meta.cranBase : undefined;
		const archived: string[] = [];
		let db: PkgDb;

		if(scope === 'latest') {
			const noncran: string[] = [];
			const pkgs: Record<string, PkgDbLatestEntry> = {};
			for(const { name, version, ex } of relevant) {
				pkgs[name] = [version, encode(ex.exported)];
				if(this.raw.get(name)?.archived) {
					archived.push(name);
				}
				if(!ex.cran) {
					noncran.push(name);
				}
			}
			db = { format: PkgDbMagic, schema: PkgDbSchema, scope, content, cranBase, strings, pkgs,
				...(archived.length ? { archived } : {}), ...(noncran.length ? { noncran } : {}) };
		} else {
			const lists: PkgDbItem[][] = [];
			const listIndex = new Map<string, number>();
			const internList = (names: readonly string[]): number => {
				const enc = encode(names);
				const key = JSON.stringify(enc);
				let idx = listIndex.get(key);
				if(idx === undefined) {
					idx = lists.length;
					lists.push(enc);
					listIndex.set(key, idx);
				}
				return idx;
			};
			internList([]);
			const files: string[] = [];
			const fileIndex = new Map<string, number>();
			const internFile = (f: string): number => {
				let idx = fileIndex.get(f);
				if(idx === undefined) {
					idx = files.length;
					files.push(f);
					fileIndex.set(f, idx);
				}
				return idx;
			};
			const locs: Record<string, Record<string, PkgDbLoc>> = {};
			const pkgs: Record<string, PkgDbAllEntry> = {};
			for(const [name, p] of this.raw) {
				const versions: PkgDbAllVersion[] = [];
				const nc: string[] = [];
				for(const [version, ex] of p.versions) {
					const e = internList(ex.exported), i = internList(ex.internal), d = internList(ex.deprecated);
					versions.push(d !== 0 ? [version, e, i, d] : i !== 0 ? [version, e, i] : [version, e]);
					if(!ex.cran) {
						nc.push(version);
					}
				}
				pkgs[name] = nc.length ? [p.latest, versions, nc] : [p.latest, versions];
				if(p.archived) {
					archived.push(name);
				}
				// optional: record the latest version's definition locations, if the source carried them
				const latestLoc = p.versions.get(p.latest)?.locations;
				if(latestLoc && latestLoc.size > 0) {
					const entry: Record<string, PkgDbLoc> = {};
					for(const [id, [file, line]] of latestLoc) {
						entry[id] = [internFile(file), line];
					}
					locs[name] = entry;
				}
			}
			db = { format: PkgDbMagic, schema: PkgDbSchema, scope, content, cranBase, strings, lists, pkgs,
				...(archived.length ? { archived } : {}),
				...(files.length ? { files, locs } : {}) };
		}
		return { ...db, content: { ...content, hash: hash53(JSON.stringify(db)) } } as PkgDb;
	}
}

export class PkgDatabase {
	private readonly db:       PkgDb;
	private readonly archived: Set<string>;
	private readonly noncran:  Set<string>;

	public constructor(db: PkgDb) {
		this.db = db;
		this.archived = new Set(db.archived ?? []);
		this.noncran = new Set(db.noncran ?? []);
	}

	public get content(): PkgDbContent {
		return this.db.content;
	}

	public get scope(): 'latest' | 'all' {
		return this.db.scope;
	}

	/** parse an already-loaded object (validates the schema, throwing a descriptive error on failure) */
	public static fromObject(obj: unknown): PkgDatabase {
		validatePkgDb(obj);
		return new PkgDatabase(obj);
	}

	/** portable async load from raw bytes (gzip auto-detected) */
	public static async fromBytes(bytes: Uint8Array): Promise<PkgDatabase> {
		const text = isGzip(bytes) ? await gunzip(bytes) : new TextDecoder().decode(bytes);
		return PkgDatabase.fromObject(JSON.parse(text));
	}

	/** portable async load from a URL (works in Node 18+, browser and VS Code) */
	public static async fromUrl(url: string): Promise<PkgDatabase> {
		return PkgDatabase.fromBytes(new Uint8Array(await (await fetch(url)).arrayBuffer()));
	}

	/** synchronous load from a local file (Node only; brotli by `.br`, else gzip auto-detected, else plain) */
	public static fromFileSync(file: string): PkgDatabase {
		const raw = fs.readFileSync(file);
		const bytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
		const text = file.endsWith('.br') ? zlib.brotliDecompressSync(raw).toString('utf8')
			: isGzip(bytes) ? zlib.gunzipSync(raw).toString('utf8')
				: raw.toString('utf8');
		return PkgDatabase.fromObject(JSON.parse(text));
	}

	public has(pkg: string): boolean {
		return this.db.pkgs[pkg] !== undefined;
	}

	private decode(list: readonly PkgDbItem[] | undefined): string[] {
		return (list ?? []).map(x => typeof x === 'number' ? this.db.strings[x] : x);
	}

	private result(pkg: string, version: string, latest: string, cran: boolean, exported: string[], internal: string[], deprecated: string[], locations?: ReadonlyMap<string, PkgDbDefinitionLocation>): LibraryExports {
		const cranBase = this.db.cranBase ?? DefaultCranBase;
		return {
			version, exported, internal, deprecated, cran,
			cranUrl: cranBlobUrl(cranBase, pkg, version, { latest, archived: this.archived.has(pkg), cran }),
			...(locations ? { locations } : {})
		};
	}

	/** definition locations of the latest version, if the (`all`-scope) database carries them */
	private locations(pkg: string): ReadonlyMap<string, PkgDbDefinitionLocation> | undefined {
		if(this.db.scope !== 'all' || !this.db.locs || !this.db.files) {
			return undefined;
		}
		const entry = this.db.locs[pkg];
		if(!entry) {
			return undefined;
		}
		const files = this.db.files;
		const map = new Map<string, PkgDbDefinitionLocation>();
		for(const id in entry) {
			const [fileIdx, line] = entry[id];
			map.set(id, { file: files[fileIdx], line });
		}
		return map;
	}

	/** look up the identifiers of a package (defaulting to its latest version) */
	public lookup(pkg: string, version?: string): LibraryExports | undefined {
		if(this.db.scope === 'latest') {
			const entry = this.db.pkgs[pkg];
			if(!entry) {
				return undefined;
			}
			return this.result(pkg, entry[0], entry[0], !this.noncran.has(pkg), this.decode(entry[1]), [], []);
		}
		const entry = this.db.pkgs[pkg];
		if(!entry) {
			return undefined;
		}
		const [latest, versions, nc] = entry;
		const vt = (version ? versions.find(v => v[0] === version) : undefined)
			?? versions.find(v => v[0] === latest) ?? versions[versions.length - 1];
		if(!vt) {
			return undefined;
		}
		const lists = this.db.lists;
		// locations are only stored for the latest version
		const locations = vt[0] === latest ? this.locations(pkg) : undefined;
		return this.result(pkg, vt[0], latest, !nc?.includes(vt[0]),
			this.decode(lists[vt[1]]), this.decode(lists[vt[2] ?? 0]), this.decode(lists[vt[3] ?? 0]), locations);
	}
}
