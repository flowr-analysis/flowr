import { RShell } from '../r-bridge/shell'
import { extract } from './statistics'
import { log, LogLevel } from '../util/log'
import { ALL_FEATURES, FeatureKey } from './feature'

log.updateSettings(l => l.settings.minLevel = LogLevel.error)

const shell = new RShell()
shell.tryToInjectHomeLibPath()

const processArguments = process.argv.slice(2)

console.log(`processing ${processArguments.length} files`)


if (processArguments.length === 0) {
  console.error('Please provide at least one file to generate statistics for')
  process.exit(1)
}

async function getStats(features: 'all' | FeatureKey[] = 'all') {
  const processedFeatures: 'all' | Set<FeatureKey> = features === 'all' ? 'all' : new Set(features)
  let cur = 0
  const stats = await extract(shell,
    file => console.log(`processing ${++cur}/${processArguments.length} ${file.content}`),
    processedFeatures,
    ...processArguments.map(file => ({ request: 'file' as const, content: file }))
  )
  // console.log(JSON.stringify(stats, undefined, 2))

  for(const entry of Object.keys(stats.features)) {
    if(processedFeatures !== 'all' && !processedFeatures.has(entry)) {
      continue
    }
    console.log(ALL_FEATURES[entry].toString(stats.features[entry], false))
  }

  const numberOfLinesPerFiles = stats.meta.lines.map(l => l.length).sort((a, b) => a - b)
  const sumLines = numberOfLinesPerFiles.reduce((a, b) => a + b, 0)

  const lineLengths = stats.meta.lines.flat().sort((a, b) => a - b)
  const sumOfLineLengths = lineLengths.reduce((a, b) => a + b, 0)

  console.log(`processed ${stats.meta.successfulParsed} files (skipped ${stats.meta.skipped.length} due to errors):
\ttotal number of lines: ${sumLines}
\t\tline range: [${numberOfLinesPerFiles[0]} .. ${numberOfLinesPerFiles[numberOfLinesPerFiles.length - 1]}] (avg: ${sumLines / numberOfLinesPerFiles.length}, median: ${numberOfLinesPerFiles[Math.floor(numberOfLinesPerFiles.length / 2)]})
\t\tline length range: [${lineLengths[0]} .. ${lineLengths[lineLengths.length - 1]}] (avg: ${sumOfLineLengths / lineLengths.length}, median: ${lineLengths[Math.floor(lineLengths.length / 2)]})
  `)

  shell.close()
}

void getStats('all')

