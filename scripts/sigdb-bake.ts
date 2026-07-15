// Docker build step: download any shards the committed `sigdb.remote.json` lists but the dir lacks, reusing the runtime downloader, and copy them in.
// Skips when already present, may silently use only what is already present (offline -> no CRAN, and no base floor unless previously fetched).
//   ts-node scripts/sigdb-bake.ts [dist/src/data/sigdb]

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { SigDbRemote } from '../src/project/sigdb/sigdb-download';

/** the compiled runtime downloader (imported from dist so this step needs no src transpile at bake time) */
interface DownloaderModule {
	downloadFullSigDb(opts: { onProgress?: (msg: string) => void }): Promise<{ files: readonly string[] }>
}

const dir = process.argv[2] ?? 'dist/src/data/sigdb';
const pointer = path.join(dir, 'sigdb.remote.json');
const sha256 = (f: string): string => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

void (async() => {
	if(!fs.existsSync(pointer)) {
		console.log('sigdb-bake: no link file -- shipping what is present');
		return;
	}
	const remote = JSON.parse(fs.readFileSync(pointer, 'utf8')) as SigDbRemote;
	const shards = remote.shards ?? {};
	const missing = Object.entries(shards).filter(([name, meta]) => {
		try {
			return sha256(path.join(dir, name)) !== meta.sha256;
		} catch{
			return true;
		}
	});
	if(missing.length === 0) {
		console.log(`sigdb-bake: full bundle already present (${Object.keys(shards).length} shards)`);
		return;
	}
	console.log(`sigdb-bake: ${missing.length} shard(s) missing -- downloading from ${remote.tag}`);
	try {
		const dl = await import(path.resolve('dist/src/project/sigdb/sigdb-download.js')) as DownloaderModule;
		const { files } = await dl.downloadFullSigDb({ onProgress: m => console.log(`  ${m}`) });
		for(const f of files) {
			fs.copyFileSync(f, path.join(dir, path.basename(f)));
		}
		console.log(`sigdb-bake: baked ${files.length} downloaded shard(s) into ${dir}`);
	} catch(e) {
		console.warn(`sigdb-bake: download skipped (${(e as Error).message}) -- shipping only what is already present`);
	}
})();
