import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const dir = process.argv[2] ?? 'dist/src/data/sigdb';
if(!fs.existsSync(dir)) {
	console.log(`no sigdb data at ${dir}`);
	process.exit(0);
}

const zstdDecompress = (zlib as { zstdDecompressSync?: (buf: Buffer) => Buffer }).zstdDecompressSync;

let done = 0;
for(const file of fs.readdirSync(dir)) {
	if(file.endsWith('.br')) {
		const from = path.join(dir, file);
		const to = path.join(dir, file.slice(0, -'.br'.length));
		if(fs.existsSync(to)) {
			continue;
		}
		const plain = zlib.brotliDecompressSync(fs.readFileSync(from), {
			params: { [zlib.constants.BROTLI_DECODER_PARAM_LARGE_WINDOW]: 1 }
		});
		fs.writeFileSync(to, plain);
		fs.rmSync(from);
		done++;
		console.log(`  decompress ${file} -> ${path.basename(to)} (${(plain.length / 1e6).toFixed(2)} MB)`);
	} else if(file.endsWith('.zst')) {
		if(typeof zstdDecompress !== 'function') {
			console.log(`  skip ${file} (zstd not supported in this Node version)`);
			continue;
		}
		const from = path.join(dir, file);
		const to = path.join(dir, file.slice(0, -'.zst'.length));
		if(fs.existsSync(to)) {
			continue;
		}
		const plain = zstdDecompress(fs.readFileSync(from));
		fs.writeFileSync(to, plain);
		fs.rmSync(from);
		done++;
		console.log(`  decompress ${file} -> ${path.basename(to)} (${(plain.length / 1e6).toFixed(2)} MB)`);
	}
}
console.log(`sigdb: decompressed ${done} shard${done === 1 ? '' : 's'} in ${dir}`);
