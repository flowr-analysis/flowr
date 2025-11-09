import { LogLevel } from '../../src/util/log';
import { setMinLevelOfAllLogs } from './_helper/log';
import { checkNetworkConnection } from './_helper/network';
import { RShell } from '../../src/r-bridge/shell';
import type { SemVer } from 'semver';
import { afterAll } from 'vitest';
import { TheGlobalLabelMap } from './_helper/label';
import fs from 'fs';
import { jsonReplacer } from '../../src/util/json';
import { GlobalSummaryFile } from './summary-def';
import { TreeSitterExecutor } from '../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';


declare global {
    var hasNetwork: boolean;
    var rVersion: SemVer | null | undefined;
    var hasXmlParseData: boolean;
	var produceLabelSummary: boolean;
}


globalThis.hasNetwork = false;
globalThis.hasXmlParseData = false;
globalThis.produceLabelSummary = false;

await (async() => {
	const isVerbose = process.argv.includes('--verbose');
	setMinLevelOfAllLogs(isVerbose ? LogLevel.Trace : LogLevel.Error, isVerbose);
	globalThis.produceLabelSummary = process.argv.includes('--make-summary');

	globalThis.hasNetwork = await checkNetworkConnection();
	let shell: RShell | undefined;
	try {
		shell = new RShell();
		shell.tryToInjectHomeLibPath();
		globalThis.rVersion = await shell.usedRVersion();
		globalThis.hasXmlParseData = await shell.isPackageInstalled('xmlparsedata');
	} catch(e) {
		console.error(e);
	} finally {
		shell?.close();
	}

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
