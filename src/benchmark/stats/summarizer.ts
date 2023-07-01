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

interface SliceSizeCollection {
  lines:         number[]
  characters:    number[]
  dataflowNodes: number[]
  tokens:        number[]
}

export interface SummarizedPerSliceStats {
  /** number of total slicing calls */
  numberOfSlices:     number
  /** statistics on the used slicing criteria (number of ids within criteria etc.) */
  sliceCriteriaSizes: SummarizedMeasurement
  measurements:       Map<PerSliceMeasurements, SummarizedMeasurement>
  sliceSize:          {
    [K in keyof SliceSizeCollection]: SummarizedMeasurement
  }
  // TODO: resulting slice stats
}


/**
 * Summarizes the given stats by calculating the min, max, median, mean, and the standard deviation for each measurement.
 */
export function summarizePerSliceStats(stats: Map<SlicingCriteria, PerSliceStats>): Readonly<SummarizedPerSliceStats> {
  const collect = new DefaultMap<PerSliceMeasurements, number[]>(() => [])
  const sizeOfSliceCriteria: number[] = []

  const sliceSize: SliceSizeCollection = {
    lines:         [],
    characters:    [],
    tokens:        [],
    dataflowNodes: []
  }

  for(const [_, perSliceStats] of stats) {
    for(const measure of perSliceStats.measurements) {
      collect.get(measure[0]).push(Number(measure[1]))
    }
    sizeOfSliceCriteria.push(perSliceStats.slicingCriteria.length)
    const output = perSliceStats.reconstructedCode
    sliceSize.lines.push(output.split('\n').length)
    sliceSize.characters.push(output.length)
    sliceSize.tokens.push(output.split(' ').length /* TODO: fix */)
    sliceSize.dataflowNodes.push(perSliceStats.numberOfDataflowNodesSliced)
    // TODO: collect resulting slice data
  }

  // summarize all measurements:
  const summarized = new Map<PerSliceMeasurements, SummarizedMeasurement>()
  for(const [criterion, measurements] of collect.entries()) {
    summarized.set(criterion, summarizeMeasurement(measurements))
  }

  return {
    numberOfSlices:     stats.size,
    sliceCriteriaSizes: summarizeMeasurement(sizeOfSliceCriteria),
    measurements:       summarized,
    sliceSize:          {
      lines:         summarizeMeasurement(sliceSize.lines),
      characters:    summarizeMeasurement(sliceSize.characters),
      tokens:        summarizeMeasurement(sliceSize.tokens),
      dataflowNodes: summarizeMeasurement(sliceSize.dataflowNodes)
    }
  }
}

function summarizeMeasurement(data: number[]): SummarizedMeasurement {
  const sorted = [...data].sort((a, b) => a - b) // just to avoid in-place modification
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const median = sorted[Math.floor(sorted.length / 2)]
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
  // sqrt(sum(x-mean)^2 / n)
  const std = Math.sqrt(sorted.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / sorted.length)
  return { min, max, median, mean, std }
}
