// Publish the sigdb shards to the GitHub Release `sigdb-v<version>` and/or the GHCR data image, then regenerate
// the committed `sigdb.remote.json` so its hashes match the upload (commit it afterwards). DRY RUN by default.
//   npm run publish:sigdb                          # dry run
//   npm run publish:sigdb -- --confirm             # publish both (--target=release|ghcr for one)
// Env: FLOWR_SIGDB_IMAGE (default ghcr.io/flowr-analysis/flowr-sigdb), GH_REPO.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeRemotePointer } from './sigdb-remote';

const root = path.resolve(__dirname, '..');
const bundleDir = path.join(root, 'src', 'data', 'sigdb');
const image = process.env.FLOWR_SIGDB_IMAGE ?? 'ghcr.io/flowr-analysis/flowr-sigdb';

const args = new Set(process.argv.slice(2));
const confirm = args.has('--confirm');
const targetArg = [...args].find(a => a.startsWith('--target='))?.slice('--target='.length) ?? 'both';
const targets = targetArg === 'both' ? ['release', 'ghcr'] : [targetArg];

/** run a command, echoing it; in dry-run mode only echo (never touch the outside world) */
function run(cmd: string, cmdArgs: string[], { dryRunSafe = false } = {}): string {
	const printable = `${cmd} ${cmdArgs.join(' ')}`;
	if(!confirm && !dryRunSafe) {
		console.log(`   [dry-run] ${printable}`);
		return '';
	}
	console.log(`   $ ${printable}`);
	return execFileSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

function haveTool(cmd: string): boolean {
	try {
		execFileSync(cmd, ['--version'], { stdio: 'ignore' });
		return true;
	} catch{
		return false;
	}
}

/** regenerate the committed link file (hashes match the upload) and return the downloadable shard paths */
function bundleAssets(): string[] {
	if(!fs.existsSync(bundleDir)) {
		throw new Error(`no sigdb bundle at ${bundleDir} -- generate it first (crawlr dump:sigs, then copy into src/data/sigdb)`);
	}
	const { downloadable } = writeRemotePointer({ bundleDir });
	console.log(`regenerated sigdb.remote.json (${downloadable.length} shards) -- commit it so clients auto-sync`);
	return downloadable.map(f => path.join(bundleDir, f));
}

function publishRelease(version: string, assets: string[]): void {
	if(!haveTool('gh')) {
		throw new Error('the GitHub CLI `gh` is required for --target=release (and you must be logged in)');
	}
	const tag = `sigdb-v${version}`;
	const repoFlag = process.env.GH_REPO ? ['--repo', process.env.GH_REPO] : [];
	console.log(`-> GitHub Release ${tag} (${assets.length} assets)`);
	// create the release only if it does not exist yet, then upload/overwrite the assets (idempotent)
	let exists = false;
	if(confirm) {
		try {
			execFileSync('gh', ['release', 'view', tag, ...repoFlag], { cwd: root, stdio: 'ignore' });
			exists = true;
		} catch{ /* no such release yet */ }
	}
	if(!exists) {
		run('gh', ['release', 'create', tag, ...repoFlag, '--title', `flowr-sigdb ${version}`,
			'--notes', `Signature database bundle harmonised with flowR ${version}.`, '--verify-tag']);
	}
	run('gh', ['release', 'upload', tag, ...repoFlag, '--clobber', ...assets]);
}

function publishGhcr(version: string): void {
	if(!haveTool('docker')) {
		throw new Error('docker is required for --target=ghcr (and you must be logged in to ghcr.io)');
	}
	const tags = [`${image}:${version}`, `${image}:latest`];
	console.log(`-> GHCR data image ${tags.join(', ')}`);
	// a minimal busybox image that just carries the bundle at /data/sigdb for mounting elsewhere
	const dockerfile = [
		'FROM busybox:stable',
		'LABEL org.opencontainers.image.source=https://github.com/flowr-analysis/flowr',
		`LABEL org.opencontainers.image.version=${version}`,
		'COPY sigdb/ /data/sigdb/'
	].join('\n');
	// keep the transient Dockerfile out of the repo tree entirely (the build context is src/data)
	const dfPath = path.join(os.tmpdir(), `flowr-sigdb-${version}.Dockerfile`);
	if(confirm) {
		fs.writeFileSync(dfPath, dockerfile + '\n');
	} else {
		console.log('   [dry-run] would write data-image Dockerfile:\n' + dockerfile.replace(/^/gm, '     '));
	}
	try {
		run('docker', ['build', '-f', dfPath, ...tags.flatMap(t => ['-t', t]), path.join(bundleDir, '..')]);
		for(const t of tags) {
			run('docker', ['push', t]);
		}
	} finally {
		if(confirm && fs.existsSync(dfPath)) {
			fs.rmSync(dfPath);
		}
	}
}

function main(): void {
	const version = (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }).version;
	const assets = bundleAssets();
	const totalMb = (assets.reduce((n, f) => n + fs.statSync(f).size, 0) / 1e6).toFixed(1);
	console.log(`flowr-sigdb publisher -- version ${version}, ${assets.length} shards (${totalMb} MB)${confirm ? '' : '  [DRY RUN: pass --confirm to publish]'}`);
	console.log(assets.map(a => `   - ${path.basename(a)}`).join('\n'));

	for(const t of targets) {
		if(t === 'release') {
			publishRelease(version, assets);
		} else if(t === 'ghcr') {
			publishGhcr(version);
		} else {
			throw new Error(`unknown --target=${t} (expected release, ghcr, or both)`);
		}
	}
	console.log(confirm ? 'done.' : 'dry run complete -- re-run with --confirm to publish.');
}

try {
	main();
} catch(e) {
	console.error(`publish-sigdb: ${(e as Error).message}`);
	process.exit(1);
}
