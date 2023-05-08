import { RShell } from '../r-bridge/shell'
import { extract } from './statistics'
import { log, LogLevel } from '../util/log'
import { ALL_FEATURES, FeatureKey } from './feature'
import { allRFiles } from '../util/files'

log.updateSettings(l => l.settings.minLevel = LogLevel.error)

// TODO: command line options (=> yargs?), allow to configure logging, limits, multiple folders, features to track, ...

const shell = new RShell()
shell.tryToInjectHomeLibPath()

const processArguments = process.argv.slice(2)


if (processArguments.length !== 1) {
  console.error('Please provide exactly one folder to generate statistics for (more arguments are not supported yet)')
  process.exit(1)
}

async function getStats(features: 'all' | FeatureKey[] = 'all') {
  const processedFeatures: 'all' | Set<FeatureKey> = features === 'all' ? 'all' : new Set(features)
  let cur = 0
  const stats = await extract(shell,
    file => console.log(`${new Date().toLocaleString()} processing ${++cur} ${file.content}`),
    processedFeatures,
    allRFiles(processArguments[0])
  )
  // console.log(JSON.stringify(stats, undefined, 2))

  for(const entry of Object.keys(stats.features)) {
    if(processedFeatures !== 'all' && !processedFeatures.has(entry)) {
      continue
    }
    console.log(ALL_FEATURES[entry].toString(stats.features[entry]))
  }

  // TODO: unify analysis of min/max etc.
  const numberOfLinesPerFiles = stats.meta.lines.map(l => l.length).sort((a, b) => a - b)
  const sumLines = numberOfLinesPerFiles.reduce((a, b) => a + b, 0)

  const lineLengths = stats.meta.lines.flat().sort((a, b) => a - b)
  const sumOfLineLengths = lineLengths.reduce((a, b) => a + b, 0)

  const processingTimes = stats.meta.processingTimeMs
  processingTimes.sort((a, b) => a - b)
  const sumProcessingTime = processingTimes.reduce((a, b) => a + b, 0)

  console.log(`processed ${stats.meta.successfulParsed} files (skipped ${stats.meta.skipped.length} due to errors):
\ttotal processing time: ${stats.meta.processingTimeMs.reduce((a, b) => a + b, 0)}ms
\t\tprocessing time range: [${processingTimes[0]}ms .. ${processingTimes[processingTimes.length - 1]}ms] (avg: ${sumProcessingTime / processingTimes.length}ms, median: ${processingTimes[Math.floor(processingTimes.length / 2)]}ms)
\ttotal number of lines: ${sumLines}
\t\tline range: [${numberOfLinesPerFiles[0]} .. ${numberOfLinesPerFiles[numberOfLinesPerFiles.length - 1]}] (avg: ${sumLines / numberOfLinesPerFiles.length}, median: ${numberOfLinesPerFiles[Math.floor(numberOfLinesPerFiles.length / 2)]})
\t\tline length range: [${lineLengths[0]} .. ${lineLengths[lineLengths.length - 1]}] (avg: ${sumOfLineLengths / lineLengths.length}, median: ${lineLengths[Math.floor(lineLengths.length / 2)]})
  `)

  shell.close()
}

void getStats('all')

