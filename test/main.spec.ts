// we use this file to configure the logging used when running tests

import { log, LogLevel } from '../src/util/log'

/** controlled with `--test-installation` */
export const RUN_INSTALLATION_TESTS = process.argv.includes('--test-installation')

before(() => {
  log.updateSettings(logger => {
    if (!process.argv.includes('--verbose')) {
      logger.settings.minLevel = LogLevel.error
    }
  })
})
