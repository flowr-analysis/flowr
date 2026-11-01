import { mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

/* every temporary file of a run, including those of the R shells, lands in one folder the global teardown removes */
process.env.FLOWR_TEST_TMP ??= join(tmpdir(), `flowr-test-${randomBytes(4).toString('hex')}`);
process.env.TMPDIR = process.env.TEMP = process.env.TMP = process.env.FLOWR_TEST_TMP;

/**
 * Creates the folder of the run. Not done when the config is loaded, as the teardown of a watch-mode rerun
 * removes it while the path stays set, so every setup (global and per worker) recreates it.
 */
export function ensureTestTmp(): void {
	if(process.env.FLOWR_TEST_TMP) {
		mkdirSync(process.env.FLOWR_TEST_TMP, { recursive: true });
	}
}

/** removes folders of runs that were killed before their teardown ran */
export function pruneStaleTestTmp(maxAgeMs = 24 * 60 * 60 * 1000): void {
	try {
		const root = tmpdir();
		for(const e of readdirSync(root)) {
			const full = join(root, e);
			if(e.startsWith('flowr-test-') && full !== process.env.FLOWR_TEST_TMP && Date.now() - statSync(full).mtimeMs > maxAgeMs) {
				rmSync(full, { recursive: true, force: true });
			}
		}
	} catch{
		/* best effort only */
	}
}
