/**
 * This module is tasked with processing the results of the benchmarking (see {@link SlicerStats}).
 * @module
 */
import { guard } from '../../util/assert'
import { ElapsedTime, PerSliceMeasurements, SlicerStats } from './stats'
import { SummarizedMeasurement, SummarizedPerSliceStats, summarizePerSliceStats } from './summarizer'

const padSize = 10

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
  const [seconds, rest] = divWithRest(BigInt(nanoseconds), BigInt(1e9))
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
 * Calls the {@link summarizePerSliceStats} function internally to summarize the per-slice information.
 */
export function stats2string(stats: SlicerStats): string {
  const perSliceData = summarizePerSliceStats(stats.perSliceMeasurements)

  return `
Request: ${JSON.stringify(stats.request)}
Shell init time:              ${print(stats.commonMeasurements,'initialize R session')}
Retrieval of token map:       ${print(stats.commonMeasurements,'retrieve token map')}
AST retrieval:                ${print(stats.commonMeasurements,'retrieve AST from R code')}
AST normalization:            ${print(stats.commonMeasurements,'normalize R AST')}
AST decoration:               ${print(stats.commonMeasurements,'decorate R AST')}
Dataflow creation:            ${print(stats.commonMeasurements,'produce dataflow information')}

Slicing summary for ${perSliceData.numberOfSlices} slice${perSliceData.numberOfSlices !== 1 ? 's' : ''}:
  Total:                      ${printSummarizedMeasurements(perSliceData, 'total')}
  Slice decoding:             ${printSummarizedMeasurements(perSliceData, 'decode slicing criterion')}
  Slice creation:             ${printSummarizedMeasurements(perSliceData, 'static slicing')}
  Reconstruction:             ${printSummarizedMeasurements(perSliceData, 'reconstruct code')}
  Used Slice Sizes:           ${printCountSummarizedMeasurements(perSliceData.sliceCriteriaSizes)}
  Result Slice Sizes:   
    Number of lines:          ${printCountSummarizedMeasurements(perSliceData.sliceSize.lines)}
    Number of characters:     ${printCountSummarizedMeasurements(perSliceData.sliceSize.characters)}
    Number of R tokens:       ${printCountSummarizedMeasurements(perSliceData.sliceSize.tokens)}
    Normalized R tokens:      ${printCountSummarizedMeasurements(perSliceData.sliceSize.normalizedTokens)}
    Number of dataflow nodes: ${printCountSummarizedMeasurements(perSliceData.sliceSize.dataflowNodes)}

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
