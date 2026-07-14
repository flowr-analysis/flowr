/**
 * The sharded-database manifest format (shard/dictionary descriptors that route a set of shard files as one
 * database), reading/writing it, and discovering the bundled manifests/bundles on flowR's search path. Split
 * out of `../sigdb` as pure format + filesystem discovery, with no dependency on the reader/writer classes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SigDbExt, type SigDbPkgMeta, type SigDbShard, type SigDbTier } from './schema';
import type { ByteRange, SigDbIndexWire, SigShardIndexWire } from './index-format';
import { CompressedExtPattern, compressedExtOf, decompressSyncFor, readableExtsPreferred, stripCompressedExt, writeCodecs } from './codec';

export const SigDbManifestMagic = 'flowr-sigdb-manifest';
export const SigDbManifestSchema = 2;

/** shared-dictionary descriptor in a {@link SigDbManifest}: where it lives and how to seek/verify it */
export interface SigDbDictRef { id: string; path: string; hash: string; range: ByteRange; byteCount: number; strings: number }

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
	 * the shard's compact index embedded in the manifest (without its own `meta`/`d` -- those are shared). A
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

/** write a {@link SigDbManifest} (compact JSON) plus a compressed copy per available codec (`.br` always, `.zst` when supported) beside it */
export function writeManifest(file: string, manifest: SigDbManifest): void {
	fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
	const json = JSON.stringify(manifest);
	fs.writeFileSync(file, json);
	for(const spec of writeCodecs()) {
		fs.writeFileSync(`${file}${spec.ext}`, spec.compressSync(json, { level: 11, sizeHint: json.length }));
	}
}

/** read a manifest file (transparently decompressing a `.br`/`.zst`/`.gz`) */
export function readManifestFile(manifestFile: string): SigDbManifest {
	const raw = fs.readFileSync(manifestFile);
	const text = compressedExtOf(manifestFile) ? decompressSyncFor(manifestFile, raw).toString('utf8') : raw.toString('utf8');
	return JSON.parse(text) as SigDbManifest;
}

/** breadth/temporal scope of a bundled sigdb: base R only, `current` (latest CRAN + base R), or the `full` history */
export type SigDbScope = 'base' | 'current' | 'full';
/** richest first: a container shipping the full set uses it, else the slim `current`, else the `base` floor */
const SigDbScopeOrder: readonly SigDbScope[] = ['full', 'current', 'base'];
/** layouts a bundled sigdb may sit in, relative to a search root -- the root itself (e.g. a `$FLOWR_SIGDB_DIR` data mount), then the dev `src`, build `dist` and data-dir layouts */
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
					for(const suffix of ['', ...readableExtsPreferred()]) {
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
	const manifests = new Map<string, string>();    // `<name>.manifest.json` (ignoring compression ext) -> first-found path
	const standalones = new Map<string, string>();   // `<name>.sigs.ndjson` (ignoring compression ext) -> first-found path
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
					if(new RegExp(`\\.manifest\\.json${CompressedExtPattern}$`).test(file)) {
						const key = stripCompressedExt(file);
						manifests.set(key, manifests.get(key) ?? full);
					} else if(new RegExp(`${SigDbExt.replace(/\./g, '\\.')}${CompressedExtPattern}$`).test(file) && !file.includes('.dict' + SigDbExt)) {
						const key = stripCompressedExt(file);
						standalones.set(key, standalones.get(key) ?? full);
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
	const bundles = standalones.entries().filter(([name]) => !isShard(name)).map(([, p]) => p);
	return [...orderedManifests, ...bundles];
}
