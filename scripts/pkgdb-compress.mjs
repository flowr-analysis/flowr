// Compresses the plain (git-diffable) pkgdb JSON tiers into brotli for the build output.
// The plain files live in src/data/pkgdb/; the compiled/packaged copies go to dist/src/data/pkgdb/.
// Select tiers with `--tiers=tiny,latest,all` or $FLOWR_PKGDB_TIERS; default is every tier present.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const src = 'src/data/pkgdb';
const dst = 'dist/src/data/pkgdb';

const tiersArg = process.argv.slice(2).find(a => a.startsWith('--tiers='))?.slice('--tiers='.length)
	?? process.env.FLOWR_PKGDB_TIERS;
const wantedTiers = tiersArg ? new Set(tiersArg.split(',').map(t => t.trim()).filter(Boolean)) : undefined;
const tierOf = file => file.replace(/^pkgdb-/, '').replace(/\.json$/, '');

if(!fs.existsSync(src)) {
	console.log('no pkgdb data to compress');
	process.exit(0);
}
fs.mkdirSync(dst, { recursive: true });

const expected = new Set();   // the .br outputs this run should keep; anything else in dst is stale

for(const file of fs.readdirSync(src)) {
	if(!file.endsWith('.json')) {
		continue;
	}
	if(wantedTiers && !wantedTiers.has(tierOf(file))) {
		console.log(`  skipping ${file} (not in --tiers)`);
		continue;
	}
	const srcPath = path.join(src, file);
	const outName = `${file}.br`;
	const outPath = path.join(dst, outName);
	expected.add(outName);
	// reuse an existing .br when it is at least as new as its source - brotli q11 is the slow part
	if(fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs >= fs.statSync(srcPath).mtimeMs) {
		console.log(`  ${file} -> ${outName} (up to date, skipped)`);
		continue;
	}
	const json = fs.readFileSync(srcPath);
	const br = zlib.brotliCompressSync(json, { params: {
		[zlib.constants.BROTLI_PARAM_QUALITY]:   11,
		[zlib.constants.BROTLI_PARAM_LGWIN]:     24,
		[zlib.constants.BROTLI_PARAM_SIZE_HINT]: json.length
	} });
	fs.writeFileSync(outPath, br);
	console.log(`  ${file} -> ${outName} (${(json.length / 1e6).toFixed(1)} -> ${(br.length / 1e6).toFixed(2)} MB)`);
}

// drop stale tiers (source removed or no longer wanted) so only current ones ship
for(const out of fs.readdirSync(dst)) {
	if(out.endsWith('.br') && !expected.has(out)) {
		fs.rmSync(path.join(dst, out));
		console.log(`  removed stale ${out}`);
	}
}

// warn about requested tiers whose plain source is missing (e.g. `all` is not committed)
for(const tier of wantedTiers ?? []) {
	if(!fs.existsSync(path.join(src, `pkgdb-${tier}.json`))) {
		console.warn(`  requested tier "${tier}" has no ${src}/pkgdb-${tier}.json - skipped`);
	}
}
