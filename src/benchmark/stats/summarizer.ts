/**
 * This module is tasked with processing the results of the benchmarking (see {@link SlicerStats}).
 * @module
 */
import { PerSliceMeasurements, SlicerStats } from './stats'
import { DefaultMap } from '../../util/defaultmap'
import {
  getStoredTokenMap,
  retrieveAstFromRCode,
  retrieveNumberOfRTokensOfLastParse,
  RShell,
  visit
} from '../../r-bridge'


export interface SummarizedMeasurement {
  min:    number
  max:    number
  median: number
  mean:   number
  /** standard deviation */
  std:    number
}

interface SliceSizeCollection {
  lines:            number[]
  characters:       number[]
  /** like library statements during reconstruction */
  autoSelected:     number[]
  dataflowNodes:    number[]
  tokens:           number[]
  normalizedTokens: number[]
}

/**
 * @see SlicerStats
 * @see summarizeSlicerStats
 */
export type SummarizedSlicerStats = {
  perSliceMeasurements: SummarizedPerSliceStats
} & Omit<SlicerStats, 'perSliceMeasurements'>

export interface SummarizedPerSliceStats {
  /** number of total slicing calls */
  numberOfSlices:     number
  /** statistics on the used slicing criteria (number of ids within criteria etc.) */
  sliceCriteriaSizes: SummarizedMeasurement
  measurements:       Map<PerSliceMeasurements, SummarizedMeasurement>
  sliceSize:          {
    [K in keyof SliceSizeCollection]: SummarizedMeasurement
  }
}


/**
 * Summarizes the given stats by calculating the min, max, median, mean, and the standard deviation for each measurement.
 * @see Slicer
 */
export async function summarizeSlicerStats(stats: SlicerStats): Promise<Readonly<SummarizedSlicerStats>> {
  const perSliceStats = stats.perSliceMeasurements

  const collect = new DefaultMap<PerSliceMeasurements, number[]>(() => [])
  const sizeOfSliceCriteria: number[] = []
  const reParseShellSession = new RShell()
  reParseShellSession.tryToInjectHomeLibPath()
  const tokenMap = await getStoredTokenMap(reParseShellSession)

  const sliceSize: SliceSizeCollection = {
    lines:            [],
    autoSelected:     [],
    characters:       [],
    tokens:           [],
    normalizedTokens: [],
    dataflowNodes:    []
  }

  let first = true
  for(const [_, perSliceStat] of perSliceStats) {
    for(const measure of perSliceStat.measurements) {
      collect.get(measure[0]).push(Number(measure[1]))
    }
    sizeOfSliceCriteria.push(perSliceStat.slicingCriteria.length)
    const { code: output, autoSelected } = perSliceStat.reconstructedCode
    sliceSize.autoSelected.push(autoSelected)
    sliceSize.lines.push(output.split('\n').length)
    sliceSize.characters.push(output.length)
    // reparse the output to get the number of tokens
    try {
      const reParsed = await retrieveAstFromRCode(
        { request: 'text', content: output, attachSourceInformation: true, ensurePackageInstalled: first },
        tokenMap,
        reParseShellSession
      )
      first = false
      let numberOfNormalizedTokens = 0
      visit(reParsed, _ => {
        numberOfNormalizedTokens++
        return false
      })
      sliceSize.normalizedTokens.push(numberOfNormalizedTokens)

      const numberOfRTokens = await retrieveNumberOfRTokensOfLastParse(reParseShellSession)
      sliceSize.tokens.push(numberOfRTokens)
    } catch(e: unknown) {
      console.error('Failed to re-parse the output of the slicer!', e)
    }

    sliceSize.dataflowNodes.push(perSliceStat.numberOfDataflowNodesSliced)
    // TODO: collect resulting slice data
  }

  // summarize all measurements:
  const summarized = new Map<PerSliceMeasurements, SummarizedMeasurement>()
  for(const [criterion, measurements] of collect.entries()) {
    summarized.set(criterion, summarizeMeasurement(measurements))
  }

  reParseShellSession.close()

  return {
    ...stats,
    perSliceMeasurements: {
      numberOfSlices:     perSliceStats.size,
      sliceCriteriaSizes: summarizeMeasurement(sizeOfSliceCriteria),
      measurements:       summarized,
      sliceSize:          {
        lines:            summarizeMeasurement(sliceSize.lines),
        characters:       summarizeMeasurement(sliceSize.characters),
        autoSelected:     summarizeMeasurement(sliceSize.autoSelected),
        tokens:           summarizeMeasurement(sliceSize.tokens),
        normalizedTokens: summarizeMeasurement(sliceSize.normalizedTokens),
        dataflowNodes:    summarizeMeasurement(sliceSize.dataflowNodes)
      }
    }
  }
}

function summarizeMeasurement(data: number[]): SummarizedMeasurement {
  // just to avoid in-place modification
  const sorted = [...data].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const median = sorted[Math.floor(sorted.length / 2)]
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
  // sqrt(sum(x-mean)^2 / n)
  const std = Math.sqrt(sorted.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / sorted.length)
  return { min, max, median, mean, std }
}
