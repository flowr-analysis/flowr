import { LogLevel } from '../../src/util/log';
import { setMinLevelOfAllLogs } from './_helper/log';
import semver, { type SemVer } from 'semver';
import { afterAll, inject } from 'vitest';
import { TheGlobalLabelMap } from './_helper/label';
import fs from 'fs';
import { jsonReplacer } from '../../src/util/json';
import { GlobalSummaryFile } from './summary-def';
import { ensureTestTmp } from '../test-tmp.mjs';
import { TreeSitterExecutor } from '../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

// another run's teardown or a tmp cleaner may have removed the folder since the global setup
ensureTestTmp();

// the tests use controlled package information; do not let the shipped CRAN signature database leak in
process.env.FLOWR_DISABLE_DEFAULT_SIGDB ??= '1';


declare global {
	var hasNetwork: boolean;
	var rVersion: SemVer | null | undefined;
	var produceLabelSummary: boolean;
}


const rVersion = inject('rVersion');
globalThis.hasNetwork = inject('hasNetwork');
globalThis.rVersion = rVersion === undefined ? undefined : semver.parse(rVersion);
globalThis.produceLabelSummary = process.argv.includes('--make-summary');
const isVerbose = process.env['FLOWR_VERBOSE'] === 'true';
setMinLevelOfAllLogs(isVerbose ? LogLevel.Trace : LogLevel.Error, isVerbose);
/* suites construct parsers while they are collected, so this must not wait for a hook (the wrapping keeps tsc's commonjs check quiet) */
await (async() => {
	await TreeSitterExecutor.initTreeSitter();
})();

/* we persist the `TheGlobalLabelMap` for the summary in the ultimate teardown */
afterAll(() => {
	try {
		fs.appendFileSync(GlobalSummaryFile, JSON.stringify(TheGlobalLabelMap, jsonReplacer) + '\n');
	} catch{
		/* if it does not work it is not a big deal, this is just for summary reasons */
	}
});
