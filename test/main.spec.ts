// we use this file to configure the logging used when running tests

import { log, LogLevel } from '../src/util/log'

before(() => {
  log.updateSettings(logger => {
    logger.settings.minLevel = LogLevel.error
  })
})
