import { info } from './script-log';

const force = process.argv.slice(2).includes('--force');

void (async() => {
	const { downloadFullSigDb, sigDbCacheComplete } = await import('../src/project/sigdb/sigdb-download');
	if(!force && sigDbCacheComplete()) {
		info('sync:sigdb: cache already complete -- nothing to do (pass --force to redownload)');
		return;
	}
	const { dir, files } = await downloadFullSigDb({ force, onProgress: m => info(`  ${m}`) });
	info(`sync:sigdb: ${files.length} shard(s) ready in ${dir}`);
})().catch((e: unknown) => {
	info(`sync:sigdb: skipped -- ${(e as Error).message}`);
});
