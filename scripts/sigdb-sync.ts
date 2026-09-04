import { info } from './script-log';

const force = process.argv.slice(2).includes('--force');

void (async() => {
	const { downloadFullSigDb, sigDbCacheComplete } = await import('../src/project/sigdb/sigdb-download');
	if(!force && sigDbCacheComplete()) {
		info('sigdb:sync: cache already complete -- nothing to do (pass --force to redownload)');
		return;
	}
	const { dir, files } = await downloadFullSigDb({ force, onProgress: m => info(`  ${m}`) });
	info(`sigdb:sync: ${files.length} shard(s) ready in ${dir}`);
})().catch((e: unknown) => {
	info(`sigdb:sync: skipped -- ${(e as Error).message}`);
});
