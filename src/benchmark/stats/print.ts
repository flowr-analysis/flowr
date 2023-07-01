/**
 * This module is tasked with processing the results of the benchmarking (see {@link SlicerStats}).
 * @module
 */
import { guard } from '../../util/assert'
import { ElapsedTime, PerSliceMeasurements, SlicerStats } from './stats'
import { SummarizedPerSliceStats, summarizePerSliceStats } from './summarizer'

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
  return `${secondsStr}${millisecondsStr}${nanoStr}${unit}`.padStart(10, ' ')
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

/**
 * Converts the given stats to a human-readable string.
 * Calls the {@link summarizePerSliceStats} function internally to summarize the per-slice information.
 */
export function stats2string(stats: SlicerStats): string {
  const perSliceData = summarizePerSliceStats(stats.perSliceMeasurements)

  return `
Request: ${JSON.stringify(stats.request)}
Shell init time:        ${print(stats.commonMeasurements,'initialize R session')}
Retrieval of token map: ${print(stats.commonMeasurements,'retrieve token map')}
AST retrieval:          ${print(stats.commonMeasurements,'retrieve AST from R code')}
AST normalization:      ${print(stats.commonMeasurements,'normalize R AST')}
AST decoration:         ${print(stats.commonMeasurements,'decorate R AST')}
Dataflow creation:      ${print(stats.commonMeasurements,'produce dataflow information')}

Slicing ${perSliceData.numberOfSlices} slice${perSliceData.numberOfSlices !== 1 ? 's' : ''}:
  Total:                ${printSummarizedMeasurements(perSliceData, 'total')}
  Slice decoding:       ${printSummarizedMeasurements(perSliceData, 'decode slicing criterion')}
  Slice creation:       ${printSummarizedMeasurements(perSliceData, 'static slicing')}
  Reconstruction:       ${printSummarizedMeasurements(perSliceData, 'reconstruct code')}

Shell close:            ${print(stats.commonMeasurements, 'close R session')}
Total:                  ${print(stats.commonMeasurements, 'total')}
Input: ${JSON.stringify(stats.input)})}
Dataflow: ${JSON.stringify(stats.dataflow)})}`
}
