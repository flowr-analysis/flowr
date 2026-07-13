// Materializes the bundled sigdb *dictionary* (`*.dict.sigs.ndjson.br`) into its plain form so the reader
// uses it directly (see `resolveSource`/`ensurePlainSync` in sigdb.ts) instead of brotli-decompressing it on
// the first lookup. The dictionary is the one file every shard needs, so shipping it uncompressed removes the
// largest startup decompression; the shards stay compressed and decompress lazily, only the ones a script
// actually touches. Used by the Docker images (which want fast first-lookup); npm keeps the compressed form to
// stay small. Pass the sigdb data directory (default: dist/src/data/sigdb).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dir = process.argv[2] ?? 'dist/src/data/sigdb';
if(!fs.existsSync(dir)) {
	console.log(`no sigdb data at ${dir}`);
	process.exit(0);
}

let done = 0;
for(const file of fs.readdirSync(dir)) {
	if(!file.endsWith('.dict.sigs.ndjson.br')) {
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
