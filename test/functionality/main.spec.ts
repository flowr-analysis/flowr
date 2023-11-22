/**
 * We use this file to configure the logging used when running tests
 *
 * @module
 */

import { LogLevel, setMinLevelOfAllLogs } from '../../src/util/log'


export const VERBOSE_TESTS = process.argv.includes('--verbose')
before(() => setMinLevelOfAllLogs(VERBOSE_TESTS ? LogLevel.Trace : LogLevel.Error, VERBOSE_TESTS))

/** controlled with the `--test-installation` parameter */
export const RUN_INSTALLATION_TESTS = process.argv.includes('--test-installation')

export function isInstallTest(test: Mocha.Context): void {
	if(!RUN_INSTALLATION_TESTS) {
		console.warn('skipping installation test (set RUN_INSTALLATION_TESTS to run it)')
		test.skip()
	}
}
