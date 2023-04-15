// we use this file to configure the logging used when running tests

import { log, LogLevel } from '../src/util/log'

before(() => {
  log.updateSettings(logger => {
    if (!process.argv.includes('--test-with-logs')) {
      logger.settings.minLevel = LogLevel.error
    }
  })
})
