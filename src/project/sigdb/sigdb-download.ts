import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import type { IncomingMessage } from 'http';
import { sigDbCacheDir } from './decompress';
import { CompressedExtPattern, compressedExtOf, readableExtsPreferred, stripCompressedExt } from './codec';
import { flowrVersion } from '../../util/version';

/** the GitHub `owner/repo` the full-history bundle is published to (see `scripts/publish-sigdb.mjs`) */
const DefaultRepo = 'flowr-analysis/flowr';

interface ReleaseAsset {
	name:                 string
	browser_download_url: string
	size:                 number
}

/** GitHub request headers; the token (used only for the API's rate limit and private repos) is attached only when `withAuth` */
function ghHeaders(accept: string, withAuth: boolean): Record<string, string> {
	const token = withAuth ? (process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN) : undefined;
	return { 'User-Agent': 'flowr', Accept: accept, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** how long a connection may stay silent before we give up on it */
const IdleTimeoutMs = 30_000;
/** attempts per request, so a flaky connection does not fail a whole sync */
const MaxAttempts = 3;

/** an HTTP failure; `retryable` for server-side and rate-limit errors */
class HttpError extends Error {
	constructor(message: string, public readonly retryable: boolean) {
		super(message);
	}
}

/** GET following redirects (GitHub asset URLs redirect to a storage host); resolves the final response for streaming */
function httpGet(url: string, accept: string, redirects = 5, withAuth = true): Promise<IncomingMessage> {
	return new Promise((resolve, reject) => {
		const req = (url.startsWith('http:') ? http : https).get(url, { headers: ghHeaders(accept, withAuth) }, res => {
			const status = res.statusCode ?? 0;
			if(status >= 300 && status < 400 && res.headers.location && redirects > 0) {
				res.resume();
				const next = new URL(res.headers.location, url);
				// GitHub redirects a release-asset download to a pre-signed storage host: never forward the token
				// across hosts (it is unnecessary there, leaks the token, and the signed URL rejects a second auth header)
				const keepAuth = withAuth && next.host === new URL(url).host;
				httpGet(next.toString(), accept, redirects - 1, keepAuth).then(resolve, reject);
			} else if(status >= 200 && status < 300) {
				resolve(res);
			} else {
				res.resume();
				reject(new HttpError(`GET ${url} -> HTTP ${status}`, status >= 500 || status === 429 || status === 408));
			}
		});
		req.setTimeout(IdleTimeoutMs, () => req.destroy(new Error(`GET ${url} -> no data for ${IdleTimeoutMs / 1000}s`)));
		req.on('error', reject);
	});
}

/** runs `attempt` until it succeeds, retrying network and server errors with a growing pause */
async function withRetries<T>(what: string, attempt: () => Promise<T>, progress: (msg: string) => void): Promise<T> {
	for(let i = 1; ; i++) {
		try {
			return await attempt();
		} catch(e) {
			const retryable = !(e instanceof HttpError) || e.retryable;
			if(!retryable || i >= MaxAttempts) {
				throw e;
			}
			progress(`${what} failed (${(e as Error).message}), retry ${i}/${MaxAttempts - 1}`);
			await new Promise(r => setTimeout(r, 1000 * i));
		}
	}
}

async function readJson(url: string): Promise<Record<string, unknown>> {
	const res = await httpGet(url, 'application/vnd.github+json');
	const chunks: Buffer[] = [];
	for await (const c of res) {
		chunks.push(c as Buffer);
	}
	return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

const mb = (bytes: number): string => `${(bytes / 1e6).toFixed(1)} MB`;
const rate = (bytes: number, ms: number): string => `${(bytes / 1e6 / Math.max(ms / 1000, 0.001)).toFixed(1)} MB/s`;

/** Download `url` to `dest` via a temporary file, so a partial or corrupt file never lands there (checked against `sha256`, if given). */
async function downloadTo(url: string, dest: string, name: string, progress: (msg: string) => void, expected?: RemoteShard): Promise<number> {
	const part = `${dest}.${process.pid}.part`;
	const start = Date.now();
	try {
		const res = await httpGet(url, 'application/octet-stream');
		const total = expected?.bytes ?? Number(res.headers['content-length'] ?? 0);
		let received = 0;
		let nextReport = 0.25;
		const hash = crypto.createHash('sha256');
		res.on('data', (chunk: Buffer) => {
			received += chunk.length;
			hash.update(chunk);
			if(total > 5e6 && received / total >= nextReport && received < total) {
				progress(`  ${name}: ${Math.floor(received / total * 100)}% (${mb(received)} of ${mb(total)}, ${rate(received, Date.now() - start)})`);
				nextReport += 0.25;
			}
		});
		await new Promise<void>((resolve, reject) => {
			const out = fs.createWriteStream(part);
			res.on('error', reject).on('aborted', () => reject(new Error(`connection closed after ${mb(received)}`)));
			out.on('error', reject).on('finish', () => out.close(err => err ? reject(err) : resolve()));
			res.pipe(out);
		});
		if(expected === undefined && total > 0 && received !== total) {
			throw new Error(`expected ${total} bytes but got ${received}`);
		}
		if(expected !== undefined) {
			if(received !== expected.bytes) {
				throw new Error(`expected ${expected.bytes} bytes but got ${received}`);
			}
			const actual = hash.digest('hex');
			if(actual !== expected.sha256) {
				throw new Error(`sha256 mismatch (expected ${expected.sha256.slice(0, 12)}..., got ${actual.slice(0, 12)}...); the download is corrupt or sigdb.remote.json is outdated`);
			}
		}
		fs.renameSync(part, dest);
		return received;
	} finally {
		fs.rmSync(part, { force: true });
	}
}

/** hex sha256 of a file's contents (shared by the runtime verify and the `sigdb-remote` pointer generator) */
export const sha256File = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/** the committed link file naming every downloadable shard (base floor + CRAN sets); only this pointer is committed */
export const SigDbRemoteFileName = 'sigdb.remote.json';

/** one downloadable shard as recorded in the committed {@link SigDbRemoteFileName} link file */
export interface RemoteShard {
	sha256: string
	bytes:  number
}
/** the committed link file: the release tag + repo plus every downloadable shard's integrity hash + size */
export interface SigDbRemote {
	format?: string
	schema?: number
	tag:     string
	repo?:   string
	shards:  Record<string, RemoteShard>
}

/** locate the committed `sigdb.remote.json` link file in the sigdb data dir (dev `src`, built `dist`), or the one `$FLOWR_SIGDB_REMOTE` names */
function findRemotePointer(): string | undefined {
	const override = process.env.FLOWR_SIGDB_REMOTE;
	if(override) {
		return fs.existsSync(override) ? override : undefined;
	}
	const candidates = [
		path.join(__dirname, '../../data/sigdb', SigDbRemoteFileName),   // src/ and dist/src/ layouts (same depth)
		path.join(process.cwd(), 'src/data/sigdb', SigDbRemoteFileName),
		path.join(process.cwd(), 'dist/src/data/sigdb', SigDbRemoteFileName),
	];
	return candidates.find(p => {
		try {
			return fs.existsSync(p);
		} catch{
			return false;
		}
	});
}

const readPointer = (p: string): SigDbRemote => JSON.parse(fs.readFileSync(p, 'utf8')) as SigDbRemote;

/** the direct release-asset URL, which avoids the REST API rate limit; `$FLOWR_SIGDB_MIRROR` replaces the host */
const assetUrl = (repo: string, tag: string, name: string): string =>
	`${process.env.FLOWR_SIGDB_MIRROR ?? 'https://github.com'}/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`;

/** runtime-decodable variant extensions, most-preferred first, ending in plain (`''`) as a last resort */
function downloadVariantOrder(): readonly string[] {
	return [...readableExtsPreferred(), ''];
}

/**
 * Group physical asset names by their logical (compression-ext-stripped) name and pick, per logical shard, the
 * single best variant this runtime can use: `.zst` when zstd is supported, otherwise `.br` (then `.gz`/plain).
 * On a Node without zstd, a `.zst`-only logical shard is skipped entirely (it could not be decompressed). So the
 * downloader fetches exactly one variant per shard/dictionary -- never both -- matching what the reader resolves.
 */
export function selectDownloadVariants(names: Iterable<string>): string[] {
	const groups = new Map<string, Map<string, string>>();   // logical name -> (ext -> physical name)
	for(const name of names) {
		const logical = stripCompressedExt(name);
		const ext = compressedExtOf(name) ?? '';
		let byExt = groups.get(logical);
		if(!byExt) {
			byExt = new Map();
			groups.set(logical, byExt);
		}
		byExt.set(ext, name);
	}
	const order = downloadVariantOrder();
	const picked: string[] = [];
	for(const byExt of groups.values()) {
		const ext = order.find(e => byExt.has(e));
		if(ext !== undefined) {
			picked.push(byExt.get(ext) as string);
		}
	}
	return picked;
}

/** pick the richest manifest among downloaded files (a `full`/scope manifest first, else any) */
const pickManifest = (files: readonly string[]): string | undefined =>
	files.find(f => new RegExp(`full\\.manifest\\.json${CompressedExtPattern}$`).test(f))
	?? files.find(f => new RegExp(`\\.manifest\\.json${CompressedExtPattern}$`).test(f));

export interface SigDbDownloadOptions {
	/** GitHub `owner/repo` (default `flowr-analysis/flowr`) */
	readonly repo?:       string
	/** release version, i.e. tag `sigdb-v<version>` (default the running flowR version); ignored when the committed `sigdb.remote.json` is present, whose `tag` then drives the download */
	readonly version?:    string
	/** progress callback (one line per step) */
	readonly onProgress?: (msg: string) => void
	readonly force?:      boolean
}

export interface SigDbDownloadResult {
	/** the release tag the files belong to */
	readonly tag:        string
	/** the directory the bundle landed in (add it to `solver.sigdb.additionalPaths` to keep it mounted) */
	readonly dir:        string
	/** the manifest to mount (richest scope), or `undefined` if the release ships only standalone bundles */
	readonly manifest:   string | undefined
	/** every file of the bundle, downloaded now or already cached */
	readonly files:      readonly string[]
	/** the files fetched by this call */
	readonly downloaded: readonly string[]
	readonly bytes:      number
	/** how long the sync took */
	readonly ms:         number
	/** bundle directories of other releases still in the cache (e.g., the one this sync replaces) */
	readonly stale:      readonly string[]
}

/** Thrown when some files of a bundle could not be fetched; the others are cached, so a retry only fetches the rest. */
export class SigDbDownloadError extends Error {
	constructor(
		public readonly tag: string,
		public readonly failed: readonly { readonly name: string, readonly reason: string }[],
		public readonly completed: number
	) {
		super(`could not fetch ${failed.length} of ${failed.length + completed} file(s) of ${tag}: ${failed.map(f => `${f.name} (${f.reason})`).join('; ')}`);
	}
}

/** whether the file is a manifest (in any codec); these go last as they reference the shards */
export const isManifestFile = (name: string): boolean => new RegExp(`\\.manifest\\.json${CompressedExtPattern}$`).test(name);

interface PlannedFile {
	readonly name:      string
	readonly url:       string
	/** what the cached copy has to match to be reused (and the download to be accepted) */
	readonly expected?: RemoteShard
	/** the size the release lists, when there is no hash to check against */
	readonly size?:     number
}

/** the bundle directories of other tags in the cache, so a sync can say what it leaves behind */
function staleBundleDirs(current: string): string[] {
	const bundles = path.dirname(current);
	try {
		return fs.readdirSync(bundles, { withFileTypes: true })
			.filter(e => e.isDirectory() && path.join(bundles, e.name) !== current)
			.map(e => path.join(bundles, e.name));
	} catch{
		return [];
	}
}

/** whether the cached copy at `dest` can be kept */
function isCached(dest: string, file: PlannedFile): boolean {
	try {
		const size = fs.statSync(dest).size;
		if(file.expected !== undefined) {
			return size === file.expected.bytes && sha256File(dest) === file.expected.sha256;
		}
		return file.size === undefined || size === file.size;
	} catch{
		return false;
	}
}

async function syncFiles(tag: string, repo: string, planned: readonly PlannedFile[], opts: SigDbDownloadOptions): Promise<SigDbDownloadResult> {
	const progress = opts.onProgress ?? (() => {});
	const start = Date.now();
	const dir = path.join(sigDbCacheDir(), 'bundles', tag);
	fs.mkdirSync(dir, { recursive: true });
	const ordered = [...planned.filter(p => !isManifestFile(p.name)), ...planned.filter(p => isManifestFile(p.name))];
	const missing = ordered.filter(p => opts.force || !isCached(path.join(dir, p.name), p));
	const toFetch = missing.reduce((sum, p) => sum + (p.expected?.bytes ?? p.size ?? 0), 0);
	progress(`signature database ${tag} from ${repo}: ${ordered.length} file(s), ${ordered.length - missing.length} up to date, ${missing.length} to fetch (${mb(toFetch)}) into ${dir}`);

	const files: string[] = [];
	const downloaded: string[] = [];
	const failed: { name: string, reason: string }[] = [];
	let bytes = 0;
	for(const file of ordered) {
		const dest = path.join(dir, file.name);
		if(!missing.includes(file)) {
			files.push(dest);
			continue;
		}
		if(isManifestFile(file.name) && failed.length > 0) {
			failed.push({ name: file.name, reason: 'skipped, as the shards it references are incomplete' });
			continue;
		}
		const size = file.expected?.bytes ?? file.size;
		progress(`downloading ${file.name}${size === undefined ? '' : ` (${mb(size)})`}`);
		const fileStart = Date.now();
		try {
			const got = await withRetries(file.name, () => downloadTo(file.url, dest, file.name, progress, file.expected), progress);
			bytes += got;
			progress(`  ${file.name}: done in ${((Date.now() - fileStart) / 1000).toFixed(1)}s (${rate(got, Date.now() - fileStart)})${file.expected ? ', checksum verified' : ''}`);
			files.push(dest);
			downloaded.push(dest);
		} catch(e) {
			const reason = (e as Error).message;
			progress(`  ${file.name}: failed (${reason})`);
			failed.push({ name: file.name, reason });
		}
	}
	const ms = Date.now() - start;
	if(failed.length > 0) {
		throw new SigDbDownloadError(tag, failed, files.length);
	}
	/* the bundle synced last takes precedence over the others in the cache, even if nothing had to be fetched */
	const now = new Date();
	fs.utimesSync(dir, now, now);
	const stale = staleBundleDirs(dir);
	progress(downloaded.length === 0
		? `signature database ${tag} is up to date`
		: `signature database ${tag}: fetched ${downloaded.length} file(s), ${mb(bytes)} in ${(ms / 1000).toFixed(1)}s`);
	if(stale.length > 0) {
		progress(`the cache still holds ${stale.length} bundle(s) of other releases: ${stale.map(d => path.basename(d)).join(', ')} (in ${path.dirname(dir)}); the most recently synced one takes precedence, delete the others to free the space`);
	}
	return { tag, dir, manifest: pickManifest(files), files, downloaded, bytes, ms, stale };
}

/** read the committed link file, naming it in the error when it is broken */
function readPointerChecked(p: string): SigDbRemote {
	let remote: SigDbRemote;
	try {
		remote = readPointer(p);
	} catch(e) {
		throw new Error(`cannot read the signature database link file ${p}: ${(e as Error).message}`, { cause: e });
	}
	if(typeof remote.tag !== 'string' || typeof remote.shards !== 'object' || remote.shards === null) {
		throw new Error(`the signature database link file ${p} names no tag or shards`);
	}
	return remote;
}

/**
 * Downloads the signature-database shards into the cache, verified by hash and skipping cached ones. A failing file
 * does not stop the others; a {@link SigDbDownloadError} names what is missing at the end.
 * Use the returned {@link SigDbDownloadResult.manifest}, or point `solver.sigdb.additionalPaths` at the dir.
 */
export async function downloadFullSigDb(opts: SigDbDownloadOptions = {}): Promise<SigDbDownloadResult> {
	const progress = opts.onProgress ?? (() => {});
	const pointerPath = findRemotePointer();

	if(pointerPath) {
		const remote = readPointerChecked(pointerPath);
		const repo = opts.repo ?? remote.repo ?? DefaultRepo;
		// one variant per logical shard/dictionary -- the best this runtime can decompress (never both codecs)
		const planned = selectDownloadVariants(Object.keys(remote.shards)).map(name => ({
			name, url: assetUrl(repo, remote.tag, name), expected: remote.shards[name]
		}));
		return syncFiles(remote.tag, repo, planned, opts);
	}

	// fallback: no committed link file -> list the release via the API and download by size
	const repo = opts.repo ?? DefaultRepo;
	const version = opts.version ?? flowrVersion().toString();
	const tag = `sigdb-v${version}`;
	progress(`no sigdb.remote.json found, listing release ${tag} of ${repo}`);
	const release = await withRetries(`listing ${tag}`, () => readJson(`https://api.github.com/repos/${repo}/releases/tags/${tag}`), progress);
	const assets = ((release.assets as ReleaseAsset[] | undefined) ?? [])
		.filter(a => a.name.endsWith('.br') || a.name.endsWith('.zst') || a.name.endsWith('.manifest.json'));
	if(assets.length === 0) {
		throw new Error(`release ${tag} in ${repo} has no signature-database assets${typeof release.message === 'string' ? ` (${release.message})` : ''}`);
	}
	const byName = new Map(assets.map(a => [a.name, a]));
	const planned = selectDownloadVariants(byName.keys()).map(name => {
		const a = byName.get(name) as ReleaseAsset;
		return { name, url: a.browser_download_url, size: a.size };
	});
	return syncFiles(tag, repo, planned, opts);
}

/**
 * The cache dir a {@link downloadFullSigDb} for the committed link file would populate, or `undefined` if no
 * pointer is committed. Lets a caller mount an already-synced bundle via `solver.sigdb.additionalPaths` without
 * hitting the network.
 */
export function syncedSigDbDir(): string | undefined {
	const pointerPath = findRemotePointer();
	if(!pointerPath) {
		return undefined;
	}
	return path.join(sigDbCacheDir(), 'bundles', readPointer(pointerPath).tag);
}

/** the GitHub release (`{repo, tag, url}`) the committed pointer downloads from, or `undefined` when no pointer is committed */
export function sigDbRemoteRelease(): { repo: string, tag: string, url: string } | undefined {
	const pointerPath = findRemotePointer();
	if(!pointerPath) {
		return undefined;
	}
	try {
		const remote = readPointer(pointerPath);
		const repo = remote.repo ?? DefaultRepo;
		return { repo, tag: remote.tag, url: `https://github.com/${repo}/releases/tag/${remote.tag}` };
	} catch{
		return undefined;
	}
}

/** Fast presence check (existence + byte size only, no hashing) for the shards the committed pointer selects for this runtime; `false` when no pointer is committed or any selected shard is missing/wrong-size. */
export function sigDbCacheComplete(): boolean {
	const pointerPath = findRemotePointer();
	if(!pointerPath) {
		return false;
	}
	try {
		const remote = readPointer(pointerPath);
		const dir = path.join(sigDbCacheDir(undefined, false), 'bundles', remote.tag);
		return selectDownloadVariants(Object.keys(remote.shards)).every(name => {
			try {
				return fs.statSync(path.join(dir, name)).size === remote.shards[name].bytes;
			} catch{
				return false;
			}
		});
	} catch{
		return false;
	}
}

/** Startup check: `true` when a committed link file lists shards whose cached copies are missing or mismatched */
export function sigDbNeedsSync(): boolean {
	const pointerPath = findRemotePointer();
	if(!pointerPath) {
		return false;
	}
	try {
		const remote = readPointer(pointerPath);
		const dir = path.join(sigDbCacheDir(undefined, false), 'bundles', remote.tag);
		return selectDownloadVariants(Object.keys(remote.shards)).some(name => !isCached(path.join(dir, name), { name, url: '', expected: remote.shards[name] }));
	} catch{
		return false;
	}
}
