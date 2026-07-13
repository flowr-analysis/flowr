// Copy the committed sigdb (`.br` shards, manifests, `sigdb.remote.json`) into dist so it ships with npm;
// discovered at runtime by `defaultSigDbPath`. Skips plain/`.gz`/`.idx` files and drops stale copies.
import fs from 'node:fs';
import path from 'node:path';

const src = 'src/data/sigdb';
const dst = 'dist/src/data/sigdb';

if(!fs.existsSync(src)) {
	console.log('no sigdb data to copy');
	process.exit(0);
}
fs.mkdirSync(dst, { recursive: true });

const keep = new Set<string>();
let bytes = 0;
for(const file of fs.readdirSync(src)) {
	// ship the compressed artefacts (.br), the manifests, and the `sigdb.remote.json` link file (so the
	// runtime downloader/autoSync finds it under dist); skip any plain .sigs.ndjson/.gz/.idx
	if(!(file.endsWith('.br') || file.endsWith('.manifest.json') || file === 'sigdb.remote.json')) {
		continue;
	}
	const from = path.join(src, file), to = path.join(dst, file);
	keep.add(file);
	if(fs.existsSync(to) && fs.statSync(to).mtimeMs >= fs.statSync(from).mtimeMs) {
		continue;
	}
	fs.copyFileSync(from, to);
	bytes += fs.statSync(from).size;
	console.log(`  sigdb ${file} (${(fs.statSync(from).size / 1e6).toFixed(2)} MB)`);
}
// drop stale files so only the current bundle ships
for(const out of fs.readdirSync(dst)) {
	if(!keep.has(out)) {
		fs.rmSync(path.join(dst, out));
		console.log(`  removed stale ${out}`);
	}
}
console.log(`sigdb: copied ${keep.size} files (${(bytes / 1e6).toFixed(2)} MB) -> ${dst}`);
