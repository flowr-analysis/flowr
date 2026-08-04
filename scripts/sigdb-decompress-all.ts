import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dir = process.argv[2] ?? 'dist/src/data/sigdb';
if(!fs.existsSync(dir)) {
	console.log(`no sigdb data at ${dir}`);
	process.exit(0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
const zlibAny = zlib as any;
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const hasZstd = typeof zlibAny.zstdDecompressSync === 'function';

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
		if(!hasZstd) {
			console.log(`  skip ${file} (zstd not supported in this Node version)`);
			continue;
		}
		const from = path.join(dir, file);
		const to = path.join(dir, file.slice(0, -'.zst'.length));
		if(fs.existsSync(to)) {
			continue;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		const plain = zlibAny.zstdDecompressSync(fs.readFileSync(from));
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		fs.writeFileSync(to, plain);
		fs.rmSync(from);
		done++;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		console.log(`  decompress ${file} -> ${path.basename(to)} (${(plain.length / 1e6).toFixed(2)} MB)`);
	}
}
console.log(`sigdb: decompressed ${done} shard${done === 1 ? '' : 's'} in ${dir}`);
