import { ClusterReport } from './clusterer'
import { DefaultMap } from '../../util/defaultmap'
import { guard, isNotUndefined } from '../../util/assert'
import { Table } from '../../util/files'

/**
 * A conventional histogram (e.g., created by {@link histogramFromNumbers}).
 * Can be converted to a {@link Table} by {@link histogram2table}.
 */
export interface Histogram {
  /** A name intended for humans to know what the histogram is about. */
  readonly name: string
  /** Values located in each bin */
  bins:          number[]
  /** The configured size of each bin (stored explicitly to avoid semantic confusion with floating point arithmetic/problems with different rounding schemes) */
  binSize:       number
  /** Minimum value encountered (inclusive minimum of the underlying value range) */
  min:           number
  /** Maximum value encountered (inclusive maximum of the underlying value range) */
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
export function histogramsFromClusters(report: ClusterReport, binSize: number, ...filter: string[]): Histogram[] {
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

/**
 * Takes a histogram created by {@link histogramFromNumbers} and produces a CSV table from it.
 *
 * @param histograms - the histogram to convert
 * @param countAsDensity - if true, the count is divided by the total number of values (similar to pgfplots `hist/density` option)
 */
export function histogram2table(histograms: Histogram, countAsDensity = false): Table {
  const header = ['bin', 'from', 'to', 'count']
  const sum = histograms.bins.reduce((a, b) => a + b, 0)
  const rows = histograms.bins.map((count, i) => [
    i,
    i * histograms.binSize + histograms.min,
    (i + 1) * histograms.binSize + histograms.min - 1,
    countAsDensity ? count / sum : count
  ].map(String))

  return {
    header: header,
    rows:   rows
  }
}
