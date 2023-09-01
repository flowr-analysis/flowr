// we use this file to configure the logging used when running tests

import { log, LogLevel } from '../src/util/log'
import { serverLog } from '../src/cli/repl/server/server'

before(() => {
	for(const logger of [log, serverLog]) {
		logger.updateSettings(logger => {
			if(!process.argv.includes('--verbose')) {
				logger.settings.minLevel = LogLevel.error
			} else {
				log.logToFile()
			}
		})
	}
})

/** controlled with `--test-installation` */
export const RUN_INSTALLATION_TESTS = process.argv.includes('--test-installation')

export function isInstallTest(test: Mocha.Context): void {
	if(!RUN_INSTALLATION_TESTS) {
		console.warn('skipping installation test (set RUN_INSTALLATION_TESTS to run it)')
		test.skip()
	}
}
