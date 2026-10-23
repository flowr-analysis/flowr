import { info } from './script-log';

const force = process.argv.slice(2).includes('--force');

void (async() => {
	const { downloadFullSigDb, sigDbCacheComplete } = await import('../src/project/sigdb/sigdb-download');
	if(!force && sigDbCacheComplete()) {
		info('sigdb:sync: cache already complete -- nothing to do (pass --force to redownload)');
		return;
	}
	const { tag, dir, files, downloaded } = await downloadFullSigDb({ force, onProgress: m => info(`  ${m}`) });
	info(`sigdb:sync: ${tag} ready, ${files.length} file(s) in ${dir} (${downloaded.length} fetched now)`);
})().catch((e: unknown) => {
	/* never fail the surrounding script: flowR still works with the signatures it has (or without any) */
	const failed = (e as { failed?: readonly { name: string, reason: string }[] }).failed;
	if(failed !== undefined) {
		info(`sigdb:sync: incomplete, ${failed.length} file(s) missing (rerun to fetch only these):`);
		for(const { name, reason } of failed) {
			info(`  ${name}: ${reason}`);
		}
	} else {
		info(`sigdb:sync: skipped -- ${(e as Error).message}`);
	}
});
