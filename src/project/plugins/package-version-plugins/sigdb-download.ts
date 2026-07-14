import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import type { IncomingMessage } from 'http';
import { sigDbCacheDir } from '../../sigdb/decompress';
import { flowrVersion } from '../../../util/version';

/** the GitHub `owner/repo` the full-history bundle is published to (see `scripts/publish-sigdb.mjs`) */
const DefaultRepo = 'flowr-analysis/flowr';

interface ReleaseAsset {
	name:                 string
	browser_download_url: string
	size:                 number
}

/** the GitHub request headers, picking up a token from the environment when present (higher rate limit / private repos) */
function ghHeaders(accept: string): Record<string, string> {
	const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
	return { 'User-Agent': 'flowr', Accept: accept, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** GET following redirects (GitHub asset URLs redirect to a storage host); resolves the final response for streaming */
function httpGet(url: string, accept: string, redirects = 5): Promise<IncomingMessage> {
	return new Promise((resolve, reject) => {
		https.get(url, { headers: ghHeaders(accept) }, res => {
			const status = res.statusCode ?? 0;
			if(status >= 300 && status < 400 && res.headers.location && redirects > 0) {
				res.resume();
				httpGet(new URL(res.headers.location, url).toString(), accept, redirects - 1).then(resolve, reject);
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

/** the committed link file naming the downloadable shards; `base.*` ships in git and is excluded from it */
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

/** locate the committed `sigdb.remote.json` link file next to the bundled base floor (dev `src`, built `dist`) */
function findRemotePointer(): string | undefined {
	const candidates = [
		path.join(__dirname, '../../../data/sigdb', SigDbRemoteFileName),   // src/ and dist/src/ layouts (same depth)
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

/** pick the richest manifest among downloaded files (a `full`/scope manifest first, else any) */
const pickManifest = (files: readonly string[]): string | undefined =>
	files.find(f => /full\.manifest\.json(\.br)?$/.test(f)) ?? files.find(f => /\.manifest\.json(\.br)?$/.test(f));

export interface SigDbDownloadOptions {
	/** GitHub `owner/repo` (default `flowr-analysis/flowr`) */
	readonly repo?:       string
	/** release version, i.e. tag `sigdb-v<version>` (default the running flowR version) */
	readonly version?:    string
	/** progress callback (one line per asset) */
	readonly onProgress?: (msg: string) => void
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
 * committed `sigdb.remote.json` link file: it names the release tag + repo and every shard's sha256, so we build
 * a direct CDN URL (no REST API, no rate limit), verify each download by content hash, and **skip shards already
 * present with the right hash** -- which is exactly the re-sync after a `git pull` changes the link file (only
 * changed shards re-download). Without a pointer we fall back to listing the release via the API. Mount the
 * returned {@link SigDbDownloadResult.manifest}, or point `solver.sigdb.additionalPaths` at the dir.
 */
export async function downloadFullSigDb(opts: SigDbDownloadOptions = {}): Promise<SigDbDownloadResult> {
	const progress = opts.onProgress ?? (() => {});
	const pointerPath = findRemotePointer();

	if(pointerPath) {
		const remote = readPointer(pointerPath);
		const repo = opts.repo ?? remote.repo ?? DefaultRepo;
		const tag = opts.version ? `sigdb-v${opts.version}` : remote.tag;
		const dir = path.join(sigDbCacheDir(), 'bundles', tag);
		fs.mkdirSync(dir, { recursive: true });
		const entries = Object.entries(remote.shards);
		progress(`syncing ${entries.length} shards for ${tag} from ${repo}`);
		const files: string[] = [];
		for(const [name, meta] of entries) {
			const dest = path.join(dir, name);
			if(fs.existsSync(dest) && sha256File(dest) === meta.sha256) {
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
		.filter(a => a.name.endsWith('.br') || a.name.endsWith('.manifest.json'));
	if(assets.length === 0) {
		throw new Error(`release ${tag} in ${repo} has no signature-database assets${typeof release.message === 'string' ? ` (${release.message})` : ''}`);
	}
	const dir = path.join(sigDbCacheDir(), 'bundles', tag);
	fs.mkdirSync(dir, { recursive: true });
	const files: string[] = [];
	for(const a of assets) {
		const dest = path.join(dir, a.name);
		if(fs.existsSync(dest) && fs.statSync(dest).size === a.size) {
			progress(`have ${a.name}`);
		} else {
			progress(`downloading ${a.name} (${(a.size / 1e6).toFixed(1)} MB)`);
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
export function syncedSigDbDir(opts: { version?: string } = {}): string | undefined {
	const pointerPath = findRemotePointer();
	if(!pointerPath) {
		return undefined;
	}
	const tag = opts.version ? `sigdb-v${opts.version}` : readPointer(pointerPath).tag;
	return path.join(sigDbCacheDir(), 'bundles', tag);
}

/**
 * Startup check: `true` when a committed link file lists shards whose cached copies are missing or hash-mismatched
 * -- i.e. a `git pull` changed the pointer and a re-sync ({@link downloadFullSigDb}) is due. Purely local (no
 * network), so it is safe to call on every start before deciding whether to sync in the background.
 */
export function sigDbNeedsSync(opts: { version?: string } = {}): boolean {
	const pointerPath = findRemotePointer();
	if(!pointerPath) {
		return false;
	}
	try {
		const remote = readPointer(pointerPath);
		const tag = opts.version ? `sigdb-v${opts.version}` : remote.tag;
		const dir = path.join(sigDbCacheDir(), 'bundles', tag);
		return Object.entries(remote.shards).some(([name, meta]) => {
			const dest = path.join(dir, name);
			return !fs.existsSync(dest) || sha256File(dest) !== meta.sha256;
		});
	} catch{
		return false;
	}
}
