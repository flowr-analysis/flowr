/**
 * This module is tasked with processing the results of the benchmarking (see {@link SummarizedSlicerStats}).
 * @module
 */
import { guard } from '../../util/assert'
import { ElapsedTime, PerSliceMeasurements } from './stats'
import {
  SummarizedMeasurement,
  SummarizedPerSliceStats,
  SummarizedSlicerStats
} from './summarizer'

const padSize = 15

function pad<T>(string: T) {
  return String(string).padStart(padSize, ' ')
}

function divWithRest(dividend: bigint, divisor: bigint): [bigint, bigint] {
  return [dividend / divisor, dividend % divisor]
}

function formatNanoseconds(nanoseconds: bigint | number): string {
  if(nanoseconds < 0) {
    return `??`
  }
  const [seconds, rest] = divWithRest(typeof nanoseconds === 'number' ? BigInt(Math.round(nanoseconds)) : nanoseconds, BigInt(1e9))
  const [milliseconds, remainingNanoseconds] = divWithRest(rest, BigInt(1e6))

  const secondsStr= seconds > 0 ? `${String(seconds).padStart(2, '0')}.` : ''
  const millisecondsStr = seconds > 0 ? `${String(milliseconds).padStart(3, '0')}:` : `${String(milliseconds)}:`
  const nanoStr = String(remainingNanoseconds).padEnd(3, '0').substring(0, 3)
  const unit = seconds === 0n ? 'ms' : 's'
  // TODO: round correctly?
  return pad(`${secondsStr}${millisecondsStr}${nanoStr}${unit}`)
}


function print<K>(measurements: Map<K, ElapsedTime>, key: K) {
  const time = measurements.get(key)
  guard(time !== undefined, `Measurement for ${JSON.stringify(key)} not found`)
  return formatNanoseconds(time)
}

function printSummarizedMeasurements(stats: SummarizedPerSliceStats, key: PerSliceMeasurements): string {
  const measure = stats.measurements.get(key)
  guard(measure !== undefined, `Measurement for ${JSON.stringify(key)} not found`)
  return `${formatNanoseconds(measure.min)} - ${formatNanoseconds(measure.max)} (median: ${formatNanoseconds(measure.median)}, mean: ${formatNanoseconds(measure.mean)}, std: ${formatNanoseconds(measure.std)})`
}

function printCountSummarizedMeasurements(stats: SummarizedMeasurement): string {
  const range = `${stats.min} - ${stats.max}`.padStart(padSize, ' ')
  return `${range} (median: ${stats.median}, mean: ${stats.mean}, std: ${stats.std})`
}

/**
 * Converts the given stats to a human-readable string.
 * You may have to {@link summarizeSlicerStats | summarize} the stats first.
 */
export function stats2string(stats: SummarizedSlicerStats): string {
  let result = `
Request: ${JSON.stringify(stats.request)}
Shell init time:              ${print(stats.commonMeasurements,'initialize R session')}
Retrieval of token map:       ${print(stats.commonMeasurements,'retrieve token map')}
AST retrieval:                ${print(stats.commonMeasurements,'retrieve AST from R code')}
AST normalization:            ${print(stats.commonMeasurements,'normalize R AST')}
AST decoration:               ${print(stats.commonMeasurements,'decorate R AST')}
Dataflow creation:            ${print(stats.commonMeasurements,'produce dataflow information')}

Slicing summary for ${stats.perSliceMeasurements.numberOfSlices} slice${stats.perSliceMeasurements.numberOfSlices !== 1 ? 's' : ''}:`
  if(stats.perSliceMeasurements.numberOfSlices > 0) {
    result += `
  Total:                      ${printSummarizedMeasurements(stats.perSliceMeasurements, 'total')}
  Slice decoding:             ${printSummarizedMeasurements(stats.perSliceMeasurements, 'decode slicing criterion')}
  Slice creation:             ${printSummarizedMeasurements(stats.perSliceMeasurements, 'static slicing')}
  Reconstruction:             ${printSummarizedMeasurements(stats.perSliceMeasurements, 'reconstruct code')}
  Used Slice Criteria Sizes:  ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceCriteriaSizes)}
  Result Slice Sizes:   
    Number of lines:          ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.lines)}
    Number of characters:     ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.characters)}
    Number of auto selected:  ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.autoSelected)}
    Number of R tokens:       ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.tokens)}
    Normalized R tokens:      ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.normalizedTokens)}
    Number of dataflow nodes: ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.dataflowNodes)}
`
  }

  return `${result}
Shell close:                  ${print(stats.commonMeasurements, 'close R session')}
Total:                        ${print(stats.commonMeasurements, 'total')}

Input:
  Number of lines:            ${pad(stats.input.numberOfLines)}
  Number of characters:       ${pad(stats.input.numberOfCharacters)}
  Number of tokens:           ${pad(stats.input.numberOfRTokens)}
  Normalized R tokens:        ${pad(stats.input.numberOfNormalizedTokens)}

Dataflow:
  Number of nodes:            ${pad(stats.dataflow.numberOfNodes)}
  Number of edges:            ${pad(stats.dataflow.numberOfEdges)}
  Number of calls:            ${pad(stats.dataflow.numberOfCalls)}
  Number of function defs:    ${pad(stats.dataflow.numberOfFunctionDefinitions)}`
}
