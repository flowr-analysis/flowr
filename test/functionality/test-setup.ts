/**
 * We use this file to configure the logging used when running tests
 *
 * @module
 */

import { LogLevel } from '../../src/util/log';
import { setMinLevelOfAllLogs } from './_helper/log';
import { checkNetworkConnection } from './_helper/network';
import { RShell } from '../../src/r-bridge/shell';
import type { SemVer } from 'semver';

/* eslint-disable no-var */
declare global {
    var hasNetwork: boolean;
    var rVersion: SemVer | null | undefined;
    var hasXmlParseData: boolean;
}
/* eslint-enable no-var */

globalThis.hasNetwork = false;
globalThis.hasXmlParseData = false;

await (async() => {
	const isVerbose = process.argv.includes('--verbose');
	setMinLevelOfAllLogs(isVerbose ? LogLevel.Trace : LogLevel.Error, isVerbose);

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
})();
