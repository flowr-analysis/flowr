import { ClusterReport } from './clusterer'
import { DefaultMap } from '../../util/defaultmap'
import { guard, isNotUndefined } from '../../util/assert'

export interface Histogram {
  readonly name: string
  bins:          number[]
  binSize:       number
  min:           number
  max:           number
}

/**
 * Produces column-wise histogram-information based on a {@link ClusterReport}.
 *
 * Let's suppose you want histograms for the Assignments feature.
 * By default, for each clustered value, a histogram is produced (can be configured by `filter`).
 *
 * @param report - the report to collect histogram information from
 * @param binSize - size of each bin (see {@link histogramFromNumbers} for details on why we do not specify the bin-count)
 * @param filter - if given, only produce histograms for the given values
 */
export function histograms(report: ClusterReport, binSize: number, ...filter: string[]): Histogram[] {
  const contexts = [...report.valueInfoMap.entries()]

  // first, we collect the number of appearances for each value
  const valueCounts = new DefaultMap<string, number[]>(() => [])

  for(const id of report.contextIdMap.values()) {
    for(const [value, counts] of contexts) {
      valueCounts.get(value).push(counts.get(id))
    }
  }

  return [...valueCounts.entries()].map(([name, counts]) => filter.length === 0 || filter.includes(name) ? histogramFromNumbers(name, binSize, counts) : undefined)
    .filter(isNotUndefined)
}

/**
 * Produces a histogram from a list of numbers.
 * Because we need to create several histograms of different datasets and want to compare them, we do not accept the
 * number of bins desired and calculate the bin-size from the data (via `Math.ceil((max - min + 1) / bins)`).
 * Instead, we require the bin-size to be given.
 */
export function histogramFromNumbers(name: string, binSize: number, values: number[]): Histogram {
  guard(binSize > 0, `binSize must be greater than 0, but was ${binSize}`)
  guard(values.length > 0, `values must not be empty`)

  let min = values[0]
  let max = values[0]
  for(const v of values) {
    if(v < min) {
      min = v
    }
    if(v > max) {
      max = v
    }
  }

  const numberOfBins = Math.ceil((max - min) / binSize)
  console.log(`min: ${min}, max: ${max}, binSize: ${binSize}, numberOfBins: ${numberOfBins}`)
  const histogram = new Array(numberOfBins).fill(0) as number[]

  for(const v of values) {
    const bin = Math.floor((v - min) / binSize)
    histogram[bin]++
  }

  return {
    name: name,
    bins: histogram,
    binSize, min, max
  }
}
