// Regenerate `src/data/sigdb/sigdb.remote.json` -- the committed *link file* that points at the downloadable
// signature-database shards on the free GitHub Release.
//
// Only the tiny self-contained `base.*` floor is committed as actual data; the big shards (current.*/full.*/
// history.*) live on the Release `sigdb-v<version>`. This pointer records the release tag + repo + every
// downloadable shard's sha256 + size, so the runtime (`sigdb-download.ts`) builds a direct CDN URL (no API rate
// limit), verifies integrity by content hash, and -- because the pointer is git-tracked -- re-syncs automatically
// when a re-pack changes the hashes and the file is committed. `base.*` is EXCLUDED (it ships in git).
//
//   npm run sync:sigdb                                   # tag defaults to sigdb-v<package.json version>
//   ts-node scripts/sigdb-remote.ts --tag=sigdb-v2.11.2 --repo=flowr-analysis/flowr

import fs from 'node:fs';
import path from 'node:path';
import { sha256File, SigDbRemoteFileName, type SigDbRemote } from '../src/project/plugins/package-version-plugins/sigdb-download';

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
	/** the downloadable (non-`base.*`) shard file names, sorted */
	readonly downloadable: readonly string[]
	/** total bytes across the downloadable shards */
	readonly totalBytes:   number
	/** the recorded shards (name -> sha256 + size) */
	readonly shards:       SigDbRemote['shards']
}

/**
 * (Re)write the committed {@link SigDbRemoteFileName} link file for the downloadable (non-`base.*`) shards found in
 * the bundle directory. Shared by `npm run sync:sigdb` and the publisher (`publish-sigdb.ts`) so the pointer and
 * the uploaded assets can never drift.
 */
export function writeRemotePointer(opts: WriteRemotePointerOptions = {}): WriteRemotePointerResult {
	const bundleDir = opts.bundleDir ?? path.join(RepoRoot, 'src', 'data', 'sigdb');
	const version = (JSON.parse(fs.readFileSync(path.join(RepoRoot, 'package.json'), 'utf8')) as { version: string }).version;
	const tag = opts.tag ?? `sigdb-v${version}`;
	const repo = opts.repo ?? process.env.GH_REPO ?? 'flowr-analysis/flowr';

	// downloadable = every .br shard that is NOT the committed `base.*` floor
	const downloadable = fs.existsSync(bundleDir)
		? fs.readdirSync(bundleDir).filter(f => f.endsWith('.br') && !f.startsWith('base.')).sort()
		: [];
	if(downloadable.length === 0) {
		throw new Error(`no downloadable shards in ${bundleDir} (expected current.*.br / history.*.br etc.) -- copy a bundle in first`);
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

// CLI entry (skipped when imported, e.g. by publish-sigdb.ts)
if(require.main === module) {
	const { out, downloadable, totalBytes, shards } = writeRemotePointer(parseArgs(process.argv.slice(2)));
	console.log(`wrote ${path.relative(RepoRoot, out)} -- ${downloadable.length} shards (${(totalBytes / 1e6).toFixed(1)} MB)`);
	for(const f of downloadable) {
		console.log(`   - ${f}  ${shards[f].sha256.slice(0, 12)}…  ${(shards[f].bytes / 1e6).toFixed(2)} MB`);
	}
}
