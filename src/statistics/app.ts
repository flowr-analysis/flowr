import { RShell } from '../r-bridge/shell'
import { extract } from './statistics'
import { log, LogLevel } from '../util/log'
import { FeatureKey } from './features/feature'
import commandLineArgs from 'command-line-args'
import { printFeatureStatistics } from './output/printStats'
import { allRFilesFrom, optionDefinitions, optionHelp, StatsCliOptions, validateFeatures } from './cli'
import commandLineUsage from 'command-line-usage'
import { initFileProvider } from './output/statisticsFile'

const options = commandLineArgs(optionDefinitions) as StatsCliOptions

if(options.help) {
  console.log(commandLineUsage(optionHelp))
  process.exit(0)
}
log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
log.info('running with options', options)

const shell = new RShell()
shell.tryToInjectHomeLibPath()

validateFeatures(options.features)
initFileProvider(options['output-dir'])

async function getStats(features: 'all' | FeatureKey[] = 'all') {
  const processedFeatures: 'all' | Set<FeatureKey> = features === 'all' ? 'all' : new Set(features)
  let cur = 0
  const stats = await extract(shell,
    file => console.log(`${new Date().toLocaleString()} processing ${++cur} ${file.content}`),
    processedFeatures,
    allRFilesFrom(options.input, options.limit)
  )

  printFeatureStatistics(stats, processedFeatures)
  shell.close()
}

void getStats(options.features)

