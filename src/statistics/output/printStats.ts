import { ALL_FEATURES, FeatureInfo, FeatureKey, FeatureStatistics } from '../features/feature'
import { MetaStatistics } from '../statistics'

interface MinMaxAvgMedian { sum: number, min: number, max: number, avg: number, median: number}

export function minMaxAvgAndMedian(data: number[]): MinMaxAvgMedian {
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

export const THIN_MATH_SPACE = '\u2009'
function formatStatNumber(num: number): string {
  return Number(num.toFixed(3)).toLocaleString()
}

export function statsString(data: MinMaxAvgMedian, suffix = ''): string {
  return `[${formatStatNumber(data.min)}${suffix} .. ${formatStatNumber(data.max)}${suffix}] (avg: ${formatStatNumber(data.avg)}${suffix}, median: ${formatStatNumber(data.median)}${suffix})`
}



export function printFeatureStatistics(statistics: {features: FeatureStatistics, meta: MetaStatistics}, features: 'all' | Set<FeatureKey> = 'all'): void {
  for(const feature of Object.keys(statistics)) {
    if(features !== 'all' && !features.has(feature)) {
      continue
    }
    const meta = ALL_FEATURES[feature]
    console.log(`\n\n-----${meta.name}-------------`)
    console.log(`\x1b[37m${meta.description}\x1b[m`)
    printFeatureStatisticsEntry(statistics.features[feature])
    console.log('\n\n')
  }

  const linesPerFile = minMaxAvgAndMedian(statistics.meta.lines.map(l => l.length))
  const lineLengths = minMaxAvgAndMedian(statistics.meta.lines.flat())
  const processingTimesPerFile = minMaxAvgAndMedian(statistics.meta.processingTimeMs)

  console.log(`processed ${statistics.meta.successfulParsed} files (skipped ${statistics.meta.skipped.length} due to errors):
\ttotal processing time: ${processingTimesPerFile.sum}${THIN_MATH_SPACE}ms
\t\tprocessing time range: ${statsString(processingTimesPerFile, `${THIN_MATH_SPACE}ms`)}
\ttotal number of lines: ${lineLengths.sum}
\t\tline range: ${statsString(linesPerFile)}
\t\tline length range: ${statsString(lineLengths,`${THIN_MATH_SPACE}chars`)}
  `)
}

const pad = 3

function printFeatureStatisticsEntry(info: FeatureInfo): void {
  let longestKey = 0
  let longestValue = 0
  const out = new Map<string, string>()
  for(const [key, value] of Object.entries(info)) {
    if(key.length > longestKey) {
      longestKey = key.length
    }
    const valueString = value.toLocaleString()
    out.set(key, valueString)
    if(valueString.length > longestValue) {
      longestValue = valueString.length
    }
  }
  for(const [key, value] of out.entries()) {
    console.log(`${key.padEnd(longestKey + pad)} ${value.padStart(longestValue)}`)
  }
}
