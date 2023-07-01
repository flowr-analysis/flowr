/**
 * This module is tasked with processing the results of the benchmarking (see {@link SlicerStats}).
 * @module
 */
import { PerSliceMeasurements, PerSliceStats } from './stats'
import { SlicingCriteria } from '../../slicing/criterion/parse'
import { DefaultMap } from '../../util/defaultmap'


export interface SummarizedMeasurement {
  min:    number
  max:    number
  median: number
  mean:   number
  /** standard deviation */
  std:    number
}

export interface SummarizedPerSliceStats {
  numberOfSlices: number
  measurements:   Map<PerSliceMeasurements, SummarizedMeasurement>
  // TODO: resulting slice stats
}

/**
 * Summarizes the given stats by calculating the min, max, median, mean, and the standard deviation for each measurement.
 */
export function summarizePerSliceStats(stats: Map<SlicingCriteria, PerSliceStats>): Readonly<SummarizedPerSliceStats> {
  const collect = new DefaultMap<PerSliceMeasurements, number[]>(() => [])
  for(const [_, perSliceStats] of stats) {
    for(const measure of perSliceStats.measurements) {
      collect.get(measure[0]).push(Number(measure[1]))
    }
    // TODO: collect resulting slice data
  }

  // summarize all measurements:
  const summarized = new Map<PerSliceMeasurements, SummarizedMeasurement>()
  for(const [criterion, measurements] of collect.entries()) {
    summarized.set(criterion, summarizeMeausrement(measurements))
  }

  return {
    numberOfSlices: stats.size,
    measurements:   summarized
  }
}

function summarizeMeausrement(data: number[]): SummarizedMeasurement {
  const sorted = [...data].sort((a, b) => a - b) // just to avoid in-place modification
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const median = sorted[Math.floor(sorted.length / 2)]
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
  // sqrt(sum(x-mean)^2 / n)
  const std = Math.sqrt(sorted.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / sorted.length)
  return { min, max, median, mean, std }
}
