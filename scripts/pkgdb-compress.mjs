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
fs.rmSync(dst, { recursive: true, force: true });   // drop stale tiers so only current ones ship
fs.mkdirSync(dst, { recursive: true });

for(const file of fs.readdirSync(src)) {
	if(!file.endsWith('.json')) {
		continue;
	}
	if(wantedTiers && !wantedTiers.has(tierOf(file))) {
		console.log(`  skipping ${file} (not in --tiers)`);
		continue;
	}
	const json = fs.readFileSync(path.join(src, file));
	const br = zlib.brotliCompressSync(json, { params: {
		[zlib.constants.BROTLI_PARAM_QUALITY]:   11,
		[zlib.constants.BROTLI_PARAM_LGWIN]:     24,
		[zlib.constants.BROTLI_PARAM_SIZE_HINT]: json.length
	} });
	fs.writeFileSync(path.join(dst, `${file}.br`), br);
	console.log(`  ${file} -> ${file}.br (${(json.length / 1e6).toFixed(1)} -> ${(br.length / 1e6).toFixed(2)} MB)`);
}

// warn about requested tiers whose plain source is missing (e.g. `all` is not committed)
for(const tier of wantedTiers ?? []) {
	if(!fs.existsSync(path.join(src, `pkgdb-${tier}.json`))) {
		console.warn(`  requested tier "${tier}" has no ${src}/pkgdb-${tier}.json - skipped`);
	}
}
