// Copies the bundled (already-brotli-compressed) sigdb into the build output so it ships with the npm
// package. The default npm bundle is the small `base` scope (base R only); richer `current`/`full` scopes
// are shipped via the Docker images, not npm. Discovered at runtime by `defaultSigDbPath` (which searches
// `dist/src/data/sigdb`). Any `<scope>.manifest.json(.br)` + its `<scope>.*.sigs.ndjson.br` shards are copied.
import fs from 'node:fs';
import path from 'node:path';

const src = 'src/data/sigdb';
const dst = 'dist/src/data/sigdb';

if(!fs.existsSync(src)) {
	console.log('no sigdb data to copy');
	process.exit(0);
}
fs.mkdirSync(dst, { recursive: true });

const keep = new Set();
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
