import fs from 'fs';
import path from 'path';
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

/** GET following redirects (GitHub asset URLs redirect to a storage host); resolves the final response for streaming */
function httpGet(url: string, accept: string, redirects = 5, withAuth = true): Promise<IncomingMessage> {
	return new Promise((resolve, reject) => {
		https.get(url, { headers: ghHeaders(accept, withAuth) }, res => {
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
				reject(new Error(`GET ${url} -> HTTP ${status}`));
			}
		}).on('error', reject);
	});
}

async function readJson(url: string): Promise<Record<string, unknown>> {
	const res = await httpGet(url, 'application/vnd.github+json');
	const chunks: Buffer[] = [];
	for await (const c of res) {
		chunks.push(c as Buffer);
	}
	return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

async function downloadTo(url: string, dest: string): Promise<void> {
	const res = await httpGet(url, 'application/octet-stream');
	await new Promise<void>((resolve, reject) => {
		const out = fs.createWriteStream(dest);
		res.on('error', reject);
		out.on('error', reject).on('finish', () => out.close(err => err ? reject(err) : resolve()));
		res.pipe(out);
	});
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

/** locate the committed `sigdb.remote.json` link file in the sigdb data dir (dev `src`, built `dist`) */
function findRemotePointer(): string | undefined {
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

/** the direct release-asset CDN URL -- bypasses the REST API (and its rate limit) entirely */
const assetUrl = (repo: string, tag: string, name: string): string =>
	`https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`;

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
	/** progress callback (one line per asset) */
	readonly onProgress?: (msg: string) => void
	readonly force?:      boolean
}

export interface SigDbDownloadResult {
	/** the directory the bundle landed in (add it to `solver.sigdb.additionalPaths` to keep it mounted) */
	readonly dir:      string
	/** the manifest to mount (richest scope), or `undefined` if the release ships only standalone bundles */
	readonly manifest: string | undefined
	/** every downloaded file */
	readonly files:    readonly string[]
}

/**
 * Download the signature-database shards into the cache directory and return where they landed. Prefers the
 * committed `sigdb.remote.json`, we verify each download by content hash, and **skip shards already
 * present with the right hash**.
 * Use the returned {@link SigDbDownloadResult.manifest}, or point `solver.sigdb.additionalPaths` at the dir.
 */
export async function downloadFullSigDb(opts: SigDbDownloadOptions = {}): Promise<SigDbDownloadResult> {
	const progress = opts.onProgress ?? (() => {});
	const pointerPath = findRemotePointer();

	if(pointerPath) {
		const remote = readPointer(pointerPath);
		const repo = opts.repo ?? remote.repo ?? DefaultRepo;
		const tag = remote.tag;
		const dir = path.join(sigDbCacheDir(), 'bundles', tag);
		fs.mkdirSync(dir, { recursive: true });
		// one variant per logical shard/dictionary -- the best this runtime can decompress (never both codecs)
		const picked = selectDownloadVariants(Object.keys(remote.shards));
		progress(`syncing ${picked.length} shards for ${tag} from ${repo}`);
		const files: string[] = [];
		for(const name of picked) {
			const meta = remote.shards[name];
			const dest = path.join(dir, name);
			if(!opts.force && fs.existsSync(dest) && sha256File(dest) === meta.sha256) {
				progress(`have ${name}`);
			} else {
				progress(`downloading ${name} (${(meta.bytes / 1e6).toFixed(1)} MB)`);
				await downloadTo(assetUrl(repo, tag, name), dest);
				if(sha256File(dest) !== meta.sha256) {
					throw new Error(`sha256 mismatch for ${name} (${tag}); the download is corrupt -- retry, or regenerate sigdb.remote.json`);
				}
			}
			files.push(dest);
		}
		return { dir, manifest: pickManifest(files), files };
	}

	// fallback: no committed link file -> list the release via the API and download by size
	const repo = opts.repo ?? DefaultRepo;
	const version = opts.version ?? flowrVersion().toString();
	const tag = `sigdb-v${version}`;
	progress(`fetching release ${tag} from ${repo}`);
	const release = await readJson(`https://api.github.com/repos/${repo}/releases/tags/${tag}`);
	const assets = ((release.assets as ReleaseAsset[] | undefined) ?? [])
		.filter(a => a.name.endsWith('.br') || a.name.endsWith('.zst') || a.name.endsWith('.manifest.json'));
	if(assets.length === 0) {
		throw new Error(`release ${tag} in ${repo} has no signature-database assets${typeof release.message === 'string' ? ` (${release.message})` : ''}`);
	}
	const dir = path.join(sigDbCacheDir(), 'bundles', tag);
	fs.mkdirSync(dir, { recursive: true });
	const byName = new Map(assets.map(a => [a.name, a]));
	const files: string[] = [];
	for(const name of selectDownloadVariants(byName.keys())) {
		const a = byName.get(name) as ReleaseAsset;
		const dest = path.join(dir, name);
		if(!opts.force && fs.existsSync(dest) && fs.statSync(dest).size === a.size) {
			progress(`have ${name}`);
		} else {
			progress(`downloading ${name} (${(a.size / 1e6).toFixed(1)} MB)`);
			await downloadTo(a.browser_download_url, dest);
		}
		files.push(dest);
	}
	return { dir, manifest: pickManifest(files), files };
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

/** Startup check: `true` when a committed link file lists shards whose cached copies are missing or hash-mismatched */
export function sigDbNeedsSync(): boolean {
	const pointerPath = findRemotePointer();
	if(!pointerPath) {
		return false;
	}
	try {
		const remote = readPointer(pointerPath);
		const dir = path.join(sigDbCacheDir(), 'bundles', remote.tag);
		return Object.entries(remote.shards).some(([name, meta]) => {
			const dest = path.join(dir, name);
			return !fs.existsSync(dest) || sha256File(dest) !== meta.sha256;
		});
	} catch{
		return false;
	}
}
