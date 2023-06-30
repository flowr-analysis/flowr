/**
 * This module is tasked with processing the results of the benchmarking (see {@link SlicerStats}).
 * @module
 */
import { guard } from '../util/assert'
import { ElapsedTime, SlicerStats } from './stats'

function divWithRest(dividend: bigint, divisor: number): [bigint, bigint] {
  return [dividend / BigInt(divisor), dividend % BigInt(divisor)]
}

function formatNanoseconds(nanoseconds: bigint): string {
  if(nanoseconds < 0) {
    return `??`
  }
  const [seconds, rest] = divWithRest(nanoseconds, 1e9)
  const [milliseconds, remainingNanoseconds] = divWithRest(rest, 1e6)

  const secondsStr= seconds > 0 ? `${String(seconds).padStart(2, '0')}.` : ''
  const millisecondsStr = seconds > 0 ? `${String(milliseconds).padStart(3, '0')}:` : `${String(milliseconds)}:`
  const nanoStr = String(remainingNanoseconds).padEnd(3, '0').substring(0, 3)
  let unit = 's'
  if(seconds === 0n) {
    unit = milliseconds === 0n ? 'ns' : 'ms'
  }
  // TODO: round correctly?
  return `${secondsStr}${millisecondsStr}${nanoStr}${unit}`.padStart(10, ' ')
}


function print<K>(measurements: Map<K, ElapsedTime>, key: K) {
  const time = measurements.get(key)
  guard(time !== undefined, `Measurement for ${JSON.stringify(key)} not found`)
  return formatNanoseconds(time)
}

export function stats2string(stats: SlicerStats): string {
  let base = `
Request: ${JSON.stringify(stats.request)}
Shell init time:        ${print(stats.commonMeasurements, 'initialize R session')}
Retrieval of token map: ${print(stats.commonMeasurements, 'retrieve token map')}
Input preparation:      ${print(stats.commonMeasurements, 'retrieve token map')}`

  // TODO:
  /*  if(slicingData !== undefined) {
    base += `
Slicing:                ${formatNanoseconds(slicingData.sliceWrite - inputPrepare)}
  AST retrieval:        ${formatNanoseconds(slicingData.astXmlRetrieval - inputPrepare)}
  AST normalization:    ${formatNanoseconds(slicingData.astXmlNormalization - slicingData.astXmlRetrieval)}
  AST decoration:       ${formatNanoseconds(slicingData.astDecoration - slicingData.astXmlNormalization)}
  Slice decoding:       ${formatNanoseconds(slicingData.sliceDecode - slicingData.astDecoration)}
  Slice mapping:        ${formatNanoseconds(slicingData.sliceMapping - slicingData.sliceDecode)}
  Dataflow creation:    ${formatNanoseconds(slicingData.dataflowCreation - slicingData.sliceMapping)}
  Slice creation:       ${formatNanoseconds(slicingData.sliceCreation - slicingData.dataflowCreation)}
  Reconstruction:       ${formatNanoseconds(slicingData.reconstruction - slicingData.sliceCreation)}
  Slice write:          ${formatNanoseconds(slicingData.sliceWrite - slicingData.reconstruction)}
`
  } else {
    base += '\nSlicing:                        ??\n'
  }*/
  base += `\nShell close:            ${print(stats.commonMeasurements, 'close R session')}
Total:                  ${print(stats.commonMeasurements, 'total')}
Input: ${JSON.stringify(stats.input)})}
Dataflow: ${JSON.stringify(stats.dataflow)})}`
  return base
}
