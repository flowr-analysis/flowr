import { RShell } from '../r-bridge'
import { extract } from './statistics'
import { log, LogLevel } from '../util/log'
import { FeatureKey } from './features'
import commandLineArgs from 'command-line-args'
import { printFeatureStatistics, initFileProvider } from './output'
import { allRFilesFrom, optionDefinitions, optionHelp, StatsCliOptions, validateFeatures } from './cli'
import commandLineUsage from 'command-line-usage'

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

async function getStats(features: 'all' | ['all'] | FeatureKey[] = 'all') {
  const processedFeatures: 'all' | Set<FeatureKey> = features === 'all' || features[0] === 'all' ? 'all' : new Set(features)
  console.log(`Processing features: ${JSON.stringify(processedFeatures)}`)
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

