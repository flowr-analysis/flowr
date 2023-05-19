import { RShell } from '../r-bridge'
import { extract } from './statistics'
import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import { printFeatureStatistics, initFileProvider, setFormatter, voidFormatter } from './output'
import { allRFilesFrom, optionDefinitions, optionHelp, StatsCliOptions, validateFeatures } from './cli'
import commandLineUsage from 'command-line-usage'
import { guard } from '../util/assert'
import { postProcessFolder, printClusterReport, histogramsFromClusters, histogram2table } from './post-process'
import { writeTableAsCsv } from '../util/files'

const options = commandLineArgs(optionDefinitions) as StatsCliOptions

if(options.help) {
  console.log(commandLineUsage(optionHelp))
  process.exit(0)
}
log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
log.info('running with options', options)
if(options['no-ansi']) {
  log.info('disabling ansi colors')
  setFormatter(voidFormatter)
}


const processedFeatures = validateFeatures(options.features)

// TODO: automatic post processing after run?
if(options['post-process']) {
  console.log('-----post processing')
  guard(options.input.length === 1, 'post processing only works with a single input file')
  const reports = postProcessFolder(options.input[0], processedFeatures)
  console.log(`found ${reports.length} reports`)
  for(const report of reports) {
    printClusterReport(report)
    const receivedHistograms = histogramsFromClusters(report, 20)
    for(const histogram of receivedHistograms) {
      const outputPath = `${report.filepath}-${histogram.name}.dat`
      console.log(`writing histogram data for ${histogram.name} to ${outputPath}`)
      writeTableAsCsv(histogram2table(histogram, true), outputPath)
    }
    /* writeFileBasedCountToFile(fileBasedCount(report), outputPath) */
  }
  process.exit(0)
}

const shell = new RShell()
shell.tryToInjectHomeLibPath()

initFileProvider(options['output-dir'])

async function getStats() {
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

void getStats()

