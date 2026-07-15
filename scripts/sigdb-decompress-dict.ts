// Expand the sigdb dictionary (`*.dict.sigs.ndjson.br`) to plain form so the reader skips brotli on the first
// lookup (used by the Docker images). Only the hot current/base dicts are expanded; the archival history/full
// dicts stay compressed (halves the image) unless FLOWR_DECOMPRESS_ALL_DICTS=1. Pass the data dir (default dist).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dir = process.argv[2] ?? 'dist/src/data/sigdb';
if(!fs.existsSync(dir)) {
	console.log(`no sigdb data at ${dir}`);
	process.exit(0);
}

const decompressAll = process.env.FLOWR_DECOMPRESS_ALL_DICTS === '1';
const coldScope = /^(history|full)\./;

let done = 0;
for(const file of fs.readdirSync(dir)) {
	if(!file.endsWith('.dict.sigs.ndjson.br')) {
		continue;
	}
	if(!decompressAll && coldScope.test(file)) {
		console.log(`  keep ${file} compressed (cold scope; decompresses lazily on an old-version lookup)`);
		continue;
	}
	const from = path.join(dir, file);
	const to = path.join(dir, file.slice(0, -'.br'.length));
	// large-window brotli, matching how the bundle is written (BROTLI_PARAM_LGWIN 30)
	const plain = zlib.brotliDecompressSync(fs.readFileSync(from), {
		params: { [zlib.constants.BROTLI_DECODER_PARAM_LARGE_WINDOW]: 1 }
	});
	fs.writeFileSync(to, plain);
	fs.rmSync(from);   // the plain file supersedes the compressed one (resolveSource prefers it)
	done++;
	console.log(`  dict ${file} -> ${path.basename(to)} (${(plain.length / 1e6).toFixed(2)} MB, removed .br)`);
}
console.log(`sigdb: materialized ${done} plain dictionar${done === 1 ? 'y' : 'ies'} in ${dir}`);
