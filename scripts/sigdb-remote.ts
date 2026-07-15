// Regenerate the committed link file `src/data/sigdb/sigdb.remote.json`: the release tag + repo + each
// downloadable shard's sha256 + size, which the runtime uses to fetch and verify them.
//   npm run sync:sigdb [-- --tag=sigdb-v2.11.2 --repo=flowr-analysis/flowr]

import fs from 'node:fs';
import path from 'node:path';
import { sha256File, SigDbRemoteFileName, type SigDbRemote } from '../src/project/sigdb/sigdb-download';
import { info } from './script-log';

const RepoRoot = path.resolve(__dirname, '..');

export interface WriteRemotePointerOptions {
	/** the sigdb bundle directory (default `<repo>/src/data/sigdb`) */
	readonly bundleDir?: string
	/** the release tag (default `sigdb-v<package.json version>`) */
	readonly tag?:       string
	/** the GitHub `owner/repo` (default `$GH_REPO` or `flowr-analysis/flowr`) */
	readonly repo?:      string
}

export interface WriteRemotePointerResult {
	/** where the link file was written */
	readonly out:          string
	/** the downloadable shard file names, sorted */
	readonly downloadable: readonly string[]
	/** total bytes across the downloadable shards */
	readonly totalBytes:   number
	/** the recorded shards (name to sha256 + size) */
	readonly shards:       SigDbRemote['shards']
}

/** the bundle dir a call resolves to (default `<repo>/src/data/sigdb`) */
function resolveBundleDir(opts: WriteRemotePointerOptions): string {
	return opts.bundleDir ?? path.join(RepoRoot, 'src', 'data', 'sigdb');
}

/** the release tag + repo a call resolves to (defaults: `sigdb-v<package.json version>`, `$GH_REPO`/flowr) */
function resolveTagRepo(opts: WriteRemotePointerOptions): { tag: string, repo: string } {
	const version = (JSON.parse(fs.readFileSync(path.join(RepoRoot, 'package.json'), 'utf8')) as { version: string }).version;
	return {
		tag:  opts.tag ?? `sigdb-v${version}`,
		repo: opts.repo ?? process.env.GH_REPO ?? 'flowr-analysis/flowr'
	};
}

// persisted compressed shard codecs (brotli/zstd); a bundle is written in one of them
const ShardExts = ['.br', '.zst'] as const;

/** every downloadable compressed shard in a bundle dir (all scopes, including the base floor), sorted */
function downloadableShards(bundleDir: string): string[] {
	return fs.existsSync(bundleDir)
		? fs.readdirSync(bundleDir).filter(f => ShardExts.some(e => f.endsWith(e))).sort()
		: [];
}

/**
 * Whether the committed link file already matches the local shards, so `sync:sigdb` can skip re-hashing the
 * (large) shards on every build. Cheap check only: same tag/repo, same shard set + byte sizes, and the pointer
 * is at least as new as every shard (mtime). Any mismatch re-hashes and rewrites via {@link writeRemotePointer}.
 */
export function remotePointerUpToDate(opts: WriteRemotePointerOptions = {}): boolean {
	const bundleDir = resolveBundleDir(opts);
	const out = path.join(bundleDir, SigDbRemoteFileName);
	const downloadable = downloadableShards(bundleDir);
	if(downloadable.length === 0 || !fs.existsSync(out)) {
		return false;
	}
	let remote: SigDbRemote;
	try {
		remote = JSON.parse(fs.readFileSync(out, 'utf8')) as SigDbRemote;
	} catch{
		return false;
	}
	const { tag, repo } = resolveTagRepo(opts);
	const recorded = Object.keys(remote.shards ?? {}).sort();
	if(remote.tag !== tag || remote.repo !== repo || recorded.length !== downloadable.length || recorded.some((f, i) => f !== downloadable[i])) {
		return false;
	}
	const pointerMtime = fs.statSync(out).mtimeMs;
	return downloadable.every(f => {
		const st = fs.statSync(path.join(bundleDir, f));
		return remote.shards[f].bytes === st.size && st.mtimeMs <= pointerMtime;
	});
}

/**
 * (Re)write the link file for the downloadable shards in the bundle dir. Shared by `sync:sigdb`
 * and `publish-sigdb.ts` so the pointer and the uploaded assets can never drift.
 */
export function writeRemotePointer(opts: WriteRemotePointerOptions = {}): WriteRemotePointerResult {
	const bundleDir = resolveBundleDir(opts);
	const { tag, repo } = resolveTagRepo(opts);

	// downloadable = every compressed shard (base floor + CRAN sets); none are committed, all are pulled from the release
	const downloadable = downloadableShards(bundleDir);
	if(downloadable.length === 0) {
		throw new Error(`no downloadable shards in ${bundleDir} (expected current.*.br / current.*.zst etc.) -- copy a bundle in first`);
	}

	const shards: SigDbRemote['shards'] = {};
	let totalBytes = 0;
	for(const f of downloadable) {
		const bytes = fs.statSync(path.join(bundleDir, f)).size;
		totalBytes += bytes;
		shards[f] = { sha256: sha256File(path.join(bundleDir, f)), bytes };
	}

	const remote: SigDbRemote = { format: 'flowr-sigdb-remote', schema: 1, tag, repo, shards };
	const out = path.join(bundleDir, SigDbRemoteFileName);
	fs.writeFileSync(out, JSON.stringify(remote, null, '\t') + '\n');
	return { out, downloadable, totalBytes, shards };
}

/** parse `--tag=` / `--repo=` from an argv list */
function parseArgs(argv: readonly string[]): WriteRemotePointerOptions {
	return {
		tag:  argv.find(a => a.startsWith('--tag='))?.slice('--tag='.length),
		repo: argv.find(a => a.startsWith('--repo='))?.slice('--repo='.length)
	};
}

// CLI (skipped when imported). Runs on every build to keep the pointer in step with the local shards; a no-op
// (no re-hashing, no output) when nothing changed, and non-fatal so a base-floor-only checkout is left untouched.
if(require.main === module) {
	try {
		const opts = parseArgs(process.argv.slice(2));
		if(!remotePointerUpToDate(opts)) {
			const { out, downloadable, totalBytes } = writeRemotePointer(opts);
			info(`sync:sigdb: wrote ${path.relative(RepoRoot, out)} -- ${downloadable.length} shards (${(totalBytes / 1e6).toFixed(1)} MB)`);
		}
	} catch(e) {
		info(`sync:sigdb: skipped -- ${(e as Error).message}`);
	}
}
