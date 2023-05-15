import { RShell } from '../r-bridge'
import { extract } from './statistics'
import { log, LogLevel } from '../util/log'
import { FeatureKey } from './features'
import commandLineArgs from 'command-line-args'
import { printFeatureStatistics, initFileProvider } from './output'
import { allRFilesFrom, optionDefinitions, optionHelp, StatsCliOptions, validateFeatures } from './cli'
import commandLineUsage from 'command-line-usage'
import { clusterStatisticsOutput } from './post-process/clusterer'
import { guard } from '../util/assert'

const options = commandLineArgs(optionDefinitions) as StatsCliOptions

if(options.help) {
  console.log(commandLineUsage(optionHelp))
  process.exit(0)
}
log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
log.info('running with options', options)

// TODO: automatic post processing after run?
if(options['post-process']) {
  console.log('-----post processing')
  guard(options.input.length === 1, 'post processing only works with a single input file')
  clusterStatisticsOutput(options.input[0])
  process.exit(0)
}

const shell = new RShell()
shell.tryToInjectHomeLibPath()

validateFeatures(options.features)
initFileProvider(options['output-dir'])

async function getStats(features: 'all' | ['all'] | FeatureKey[] = 'all') {
  const processedFeatures = (features === 'all' || features[0] === 'all' ? 'all' : new Set(features)) as 'all' | Set<FeatureKey>
  console.log(`Processing features: ${JSON.stringify(processedFeatures)}`)
  let cur = 0
  const stats = await extract(shell,
    file => console.log(`${new Date().toLocaleString()} processing ${++cur} ${file.content}`),
    processedFeatures,
    allRFilesFrom(options.input, options.limit)
  )
  console.warn(`skipped ${stats.meta.skipped.length} requests due to errors (run with logs to get more info)`)

  printFeatureStatistics(stats, processedFeatures)
  shell.close()
}

void getStats(options.features)

