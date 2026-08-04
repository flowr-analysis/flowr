// Copy the committed sigdb (`.br`/`.zst` shards, manifests, `sigdb.remote.json`) into dist so it ships with npm;
// discovered at runtime by `defaultSigDbPath`. Skips plain/`.gz`/`.idx` files and drops stale copies.
import fs from 'node:fs';
import path from 'node:path';
import { info } from './script-log';
// ship the two persisted codecs (brotli/zstd); `.gz` is a build-time byproduct and never shipped
const ShippedExts = ['.br', '.zst'] as const;

const src = 'src/data/sigdb';
const dst = 'dist/src/data/sigdb';

if(!fs.existsSync(src)) {
	info('no sigdb data to copy');
	process.exit(0);
}
fs.mkdirSync(dst, { recursive: true });

const keep = new Set<string>();
let bytes = 0;
let copied = 0;
for(const file of fs.readdirSync(src)) {
	// ship the compressed artefacts (.br/.zst), the manifests, and the `sigdb.remote.json` link file (so the
	// runtime downloader/autoSync finds it under dist); skip any plain .sigs.ndjson/.gz/.idx
	if(!(ShippedExts.some(e => file.endsWith(e)) || file.endsWith('.manifest.json') || file === 'sigdb.remote.json')) {
		continue;
	}
	const from = path.join(src, file), to = path.join(dst, file);
	keep.add(file);
	const fromStat = fs.statSync(from);
	bytes += fromStat.size;   // count every shipped file, not just the ones (re)copied this run
	if(fs.existsSync(to) && fs.statSync(to).mtimeMs >= fromStat.mtimeMs) {
		continue;
	}
	fs.copyFileSync(from, to);
	copied++;
	info(`  sigdb ${file} (${(fromStat.size / 1e6).toFixed(2)} MB)`);
}
// drop stale files so only the current bundle ships
for(const out of fs.readdirSync(dst)) {
	if(!keep.has(out)) {
		fs.rmSync(path.join(dst, out));
		info(`  removed stale ${out}`);
	}
}
const what = copied === 0 ? 'already up to date' : `copied ${copied} of`;
info(`sigdb: ${copied === 0 ? `${keep.size} files ${what}` : `${what} ${keep.size} files`} (${(bytes / 1e6).toFixed(2)} MB) -> ${dst}`);
