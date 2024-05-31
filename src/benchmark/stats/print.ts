/**
 * This module is tasked with processing the results of the benchmarking (see {@link SummarizedSlicerStats}).
 * @module
 */
import type { ElapsedTime, PerSliceMeasurements } from './stats'
import type { Reduction, SummarizedPerSliceStats, SummarizedSlicerStats, UltimateSlicerStats } from '../summarizer/data'
import { guard } from '../../util/assert'
import type { SummarizedMeasurement } from '../../util/summarizer'

const padSize = 15

function pad<T>(string: T) {
	return String(string).padStart(padSize, ' ')
}

export function formatNanoseconds(nanoseconds: bigint | number): string {
	if(nanoseconds < 0) {
		return '??'
	}

	const wholeNanos = typeof nanoseconds === 'bigint' ? nanoseconds : BigInt(Math.round(nanoseconds))
	const nanos = wholeNanos % BigInt(1e+6)
	const wholeMillis = wholeNanos / BigInt(1e+6)
	const millis = wholeMillis % BigInt(1000)
	const wholeSeconds = wholeMillis / BigInt(1000)
	if(wholeSeconds > 0){
		const nanoString = nanos > 0 ? `:${nanos}` : ''
		return pad(`${wholeSeconds}.${String(millis).padStart(3, '0')}${nanoString} s`)
	} else {
		return pad(`${millis}:${String(nanos).padStart(6, '0')}ms`)
	}
}


function print<K>(measurements: Map<K, ElapsedTime>, key: K) {
	const time = measurements.get(key)
	guard(time !== undefined, `Measurement for ${JSON.stringify(key)} not found`)
	return formatNanoseconds(time)
}

function formatSummarizedTimeMeasure(measure: SummarizedMeasurement | undefined) {
	if(measure === undefined) {
		return '??'
	}
	return `${formatNanoseconds(measure.min)} - ${formatNanoseconds(measure.max)} (median: ${formatNanoseconds(measure.median)}, mean: ${formatNanoseconds(measure.mean)}, std: ${formatNanoseconds(measure.std)})`
}

function roundTo(num: number, digits = 4): number {
	const factor = Math.pow(10, digits)
	return Math.round(num * factor) / factor
}

function asPercentage(num: number): string {
	if(isNaN(num)) {
		return '??%'
	}
	guard(num >= 0 && num <= 1, `Percentage ${num} should be between 0 and 1`)
	return pad(`${roundTo(num * 100, 3)}%`)
}

function asFloat(num: number): string {
	return pad(roundTo(num))
}

function formatSummarizedMeasure(measure: SummarizedMeasurement | undefined, fmt: (num: number) => string = asFloat) {
	if(measure === undefined) {
		return '??'
	}
	return `${fmt(measure.min)} - ${fmt(measure.max)} (median: ${fmt(measure.median)}, mean: ${fmt(measure.mean)}, std: ${fmt(measure.std)})`
}

function printSummarizedMeasurements(stats: SummarizedPerSliceStats, key: PerSliceMeasurements): string {
	const measure = stats.measurements.get(key)
	guard(measure !== undefined, `Measurement for ${JSON.stringify(key)} not found`)
	return formatSummarizedTimeMeasure(measure)
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
AST retrieval:                ${print(stats.commonMeasurements,'retrieve AST from R code')}
AST normalization:            ${print(stats.commonMeasurements,'normalize R AST')}
Dataflow creation:            ${print(stats.commonMeasurements,'produce dataflow information')}

Slicing summary for ${stats.perSliceMeasurements.numberOfSlices} slice${stats.perSliceMeasurements.numberOfSlices !== 1 ? 's' : ''}:`
	if(stats.perSliceMeasurements.numberOfSlices > 0) {
		result += `
  Total:                      ${printSummarizedMeasurements(stats.perSliceMeasurements, 'total')}
  Slice creation:             ${printSummarizedMeasurements(stats.perSliceMeasurements, 'static slicing')}
  Slice creation per token:   ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.sliceTimePerToken.normalized)}
  Slice creation per R token: ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.sliceTimePerToken.raw)}
  Reconstruction:             ${printSummarizedMeasurements(stats.perSliceMeasurements, 'reconstruct code')}
  Used Slice Criteria Sizes:  ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceCriteriaSizes)}
  Result Slice Sizes:   
    Number of lines:                     ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.lines)}
    Number of non-empty lines:           ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.nonEmptyLines)}
    Number of characters:                ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.characters)}
    Number of non whitespace characters: ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.nonWhitespaceCharacters)}
    Number of auto selected lines:       ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.linesWithAutoSelected)}
    Number of R tokens:                  ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.tokens)}
    Number of R tokens (w/o comments):   ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.tokensNoComments)}
    Normalized R tokens:                 ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.normalizedTokens)}
    Normalized R tokens (w/o comments):  ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.normalizedTokensNoComments)}
    Number of dataflow nodes:            ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.dataflowNodes)}
`
	}

	return `${result}
Shell close:                  ${print(stats.commonMeasurements, 'close R session')}
Total:                        ${print(stats.commonMeasurements, 'total')}

Input:
  Number of lines:                     ${pad(stats.input.numberOfLines)}
  Number of non empty lines:           ${pad(stats.input.numberOfNonEmptyLines)}
  Number of characters:                ${pad(stats.input.numberOfCharacters)}
  Number of characters (w/o comments): ${pad(stats.input.numberOfCharactersNoComments)}
  Number of non whitespace characters: ${pad(stats.input.numberOfNonWhitespaceCharacters)}
  Number of n. w. c. (w/o comments):   ${pad(stats.input.numberOfNonWhitespaceCharactersNoComments)}
  Number of tokens:                    ${pad(stats.input.numberOfRTokens)}
  Number of tokens (w/o comments):     ${pad(stats.input.numberOfRTokensNoComments)}
  Normalized R tokens:                 ${pad(stats.input.numberOfNormalizedTokens)}
  Normalized R tokens (w/o comments):  ${pad(stats.input.numberOfNormalizedTokensNoComments)}

Dataflow:
  Number of nodes:            ${pad(stats.dataflow.numberOfNodes)}
  Number of edges:            ${pad(stats.dataflow.numberOfEdges)}
  Number of calls:            ${pad(stats.dataflow.numberOfCalls)}
  Number of function defs:    ${pad(stats.dataflow.numberOfFunctionDefinitions)}
  Dataflow time per token:    ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.dataflowTimePerToken.normalized)}
  Dataflow time per R token:  ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.dataflowTimePerToken.raw)}`
}

export function ultimateStats2String(stats: UltimateSlicerStats): string {
	// Used Slice Criteria Sizes:  ${formatSummarizedMeasure(stats.perSliceMeasurements.sliceCriteriaSizes)}
	return `
Summarized: ${stats.totalRequests} requests and ${stats.totalSlices} slices
Shell init time:              ${formatSummarizedTimeMeasure(stats.commonMeasurements.get('initialize R session'))}
AST retrieval:                ${formatSummarizedTimeMeasure(stats.commonMeasurements.get('retrieve AST from R code'))}
AST normalization:            ${formatSummarizedTimeMeasure(stats.commonMeasurements.get('normalize R AST'))}
Dataflow creation:            ${formatSummarizedTimeMeasure(stats.commonMeasurements.get('produce dataflow information'))}

Slice summary for:
  Total:                      ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.get('total'))}
  Slice creation:             ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.get('static slicing'))}
  Slice creation per token:   ${formatSummarizedTimeMeasure(stats.sliceTimePerToken.normalized)}
  Slice creation per R token: ${formatSummarizedTimeMeasure(stats.sliceTimePerToken.raw)}
  Reconstruction:             ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.get('reconstruct code'))}
  Failed to Re-Parse:         ${pad(stats.failedToRepParse)}/${stats.totalSlices}
  Times hit Threshold:        ${pad(stats.timesHitThreshold)}/${stats.totalSlices} 
${reduction2String('Reductions', stats.reduction)}
${reduction2String('Reductions without comments and empty lines', stats.reductionNoFluff)}

Shell close:                  ${formatSummarizedTimeMeasure(stats.commonMeasurements.get('close R session'))}
Total:                        ${formatSummarizedTimeMeasure(stats.commonMeasurements.get('total'))}

Input:
  Number of lines:                     ${formatSummarizedMeasure(stats.input.numberOfLines)}
  Number of non empty lines:           ${formatSummarizedMeasure(stats.input.numberOfNonEmptyLines)}
  Number of characters:                ${formatSummarizedMeasure(stats.input.numberOfCharacters)}
  Number of characters (w/o comments): ${formatSummarizedMeasure(stats.input.numberOfCharactersNoComments)}
  Number of non whitespace characters: ${formatSummarizedMeasure(stats.input.numberOfNonWhitespaceCharacters)}
  Number of n. w. c. (w/o comments):   ${formatSummarizedMeasure(stats.input.numberOfNonWhitespaceCharactersNoComments)}
  Number of tokens:                    ${formatSummarizedMeasure(stats.input.numberOfRTokens)}
  Number of tokens (w/o comments):     ${formatSummarizedMeasure(stats.input.numberOfRTokensNoComments)}
  Normalized R tokens:                 ${formatSummarizedMeasure(stats.input.numberOfNormalizedTokens)}
  Normalized R tokens (w/o comments):  ${formatSummarizedMeasure(stats.input.numberOfNormalizedTokensNoComments)}

Dataflow:
  Number of nodes:            ${formatSummarizedMeasure(stats.dataflow.numberOfNodes)}
  Number of edges:            ${formatSummarizedMeasure(stats.dataflow.numberOfEdges)}
  Number of calls:            ${formatSummarizedMeasure(stats.dataflow.numberOfCalls)}
  Number of function defs:    ${formatSummarizedMeasure(stats.dataflow.numberOfFunctionDefinitions)}
  Dataflow time per token:    ${formatSummarizedTimeMeasure(stats.dataflowTimePerToken.normalized)}
  Dataflow time per R token:  ${formatSummarizedTimeMeasure(stats.dataflowTimePerToken.raw)}`
}

function reduction2String(title: string, reduction: Reduction<SummarizedMeasurement>) {
	return `
  ${title} (reduced by x%):   
    Number of lines:                     ${formatSummarizedMeasure(reduction.numberOfLines, asPercentage)}
    Number of lines no auto:             ${formatSummarizedMeasure(reduction.numberOfLinesNoAutoSelection, asPercentage)}
    Number of characters:                ${formatSummarizedMeasure(reduction.numberOfCharacters, asPercentage)}
    Number of non whitespace characters: ${formatSummarizedMeasure(reduction.numberOfNonWhitespaceCharacters, asPercentage)}
    Number of R tokens:                  ${formatSummarizedMeasure(reduction.numberOfRTokens, asPercentage)}
    Normalized R tokens:                 ${formatSummarizedMeasure(reduction.numberOfNormalizedTokens, asPercentage)}
    Number of dataflow nodes:            ${formatSummarizedMeasure(reduction.numberOfDataflowNodes, asPercentage)}`
}
