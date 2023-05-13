import { RShell } from '../r-bridge/shell'
import { extract } from './statistics'
import { log, LogLevel } from '../util/log'
import { FeatureKey, printFeatureStatistics } from './feature'
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

interface MinMaxAvgMedian { sum: number, min: number, max: number, avg: number, median: number}

function minMaxAvgAndMedian(data: number[]): MinMaxAvgMedian {
  data  = data.sort((a, b) => a - b)
  const sum = data.reduce((a, b) => a + b, 0)
  return {
    sum,
    min:    data[0],
    max:    data[data.length - 1],
    avg:    sum / data.length,
    median: data[Math.floor(data.length / 2)]
  }
}

const THIN_MATH_SPACE = '\u2009'
function formatStatNumber(num: number): string {
  return Number(num.toFixed(3)).toLocaleString()
}
function statsString(data: MinMaxAvgMedian, suffix = ''): string {
  return `[${formatStatNumber(data.min)}${suffix} .. ${formatStatNumber(data.max)}${suffix}] (avg: ${formatStatNumber(data.avg)}${suffix}, median: ${formatStatNumber(data.median)}${suffix})`
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

  printFeatureStatistics(stats.features, processedFeatures)

  // TODO: unify analysis of min/max etc.
  const linesPerFile = minMaxAvgAndMedian(stats.meta.lines.map(l => l.length))
  const lineLengths = minMaxAvgAndMedian(stats.meta.lines.flat())
  const processingTimesPerFile = minMaxAvgAndMedian(stats.meta.processingTimeMs)

  console.log(`processed ${stats.meta.successfulParsed} files (skipped ${stats.meta.skipped.length} due to errors):
\ttotal processing time: ${stats.meta.processingTimeMs.reduce((a, b) => a + b, 0)}ms
\t\tprocessing time range: ${statsString(processingTimesPerFile, `${THIN_MATH_SPACE}ms`)}
\ttotal number of lines: ${lineLengths.sum}
\t\tline range: ${statsString(linesPerFile)}
\t\tline length range: ${statsString(lineLengths,`${THIN_MATH_SPACE}chars`)}
  `)

  shell.close()
}

void getStats('all')

