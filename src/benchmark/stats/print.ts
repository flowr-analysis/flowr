/**
 * This module is tasked with processing the results of the benchmarking (see {@link SummarizedSlicerStats}).
 * @module
 */
import type { CommonSlicerMeasurements, ElapsedTime, PerSliceMeasurements, SlicerStatsDataflow, SlicerStatsInput } from './stats';
import type { Reduction, SummarizedPerSliceStats, SummarizedSlicerStats, TimePerToken, UltimateSlicerStats } from '../summarizer/data';
import { guard } from '../../util/assert';
import type { SummarizedMeasurement } from '../../util/summarizer';

const padSize = 15;

function pad<T>(string: T) {
	return String(string).padStart(padSize, ' ');
}

/** Formats the given nanoseconds into a human-readable string. */
export function formatNanoseconds(nanoseconds: bigint | number): string {
	if(nanoseconds < 0) {
		return '??';
	} else if(!Number.isFinite(nanoseconds)) {
		return nanoseconds > 0 ? '∞' : '-∞';
	}

	const wholeNanos = typeof nanoseconds === 'bigint' ? nanoseconds : BigInt(Math.round(nanoseconds));
	const nanos = wholeNanos % BigInt(1e+6);
	const wholeMillis = wholeNanos / BigInt(1e+6);
	const millis = wholeMillis % BigInt(1000);
	const wholeSeconds = wholeMillis / BigInt(1000);
	if(wholeSeconds > 0) {
		const nanoString = nanos > 0 ? `:${nanos}` : '';
		return pad(`${wholeSeconds}.${String(millis).padStart(3, '0')}${nanoString} s`);
	} else {
		return pad(`${millis}:${String(nanos).padStart(6, '0')}ms`);
	}
}

function print<K>(measurements: Map<K, ElapsedTime>, key: K) {
	const time = measurements.get(key);
	guard(time !== undefined, `Measurement for ${JSON.stringify(key)} not found`);
	return formatNanoseconds(time);
}

function formatSummarizedTimeMeasure(measure: SummarizedMeasurement | undefined) {
	if(measure === undefined) {
		return '??';
	}
	return `${formatNanoseconds(measure.min)} - ${formatNanoseconds(measure.max)} (median: ${formatNanoseconds(measure.median)}, mean: ${formatNanoseconds(measure.mean)}, std: ${formatNanoseconds(measure.std)})`;
}

function roundTo(num: number, digits = 4): number {
	const factor = Math.pow(10, digits);
	return Math.round(num * factor) / factor;
}

function asPercentage(num: number): string {
	if(isNaN(num)) {
		return '??%';
	}
	return pad(`${roundTo(num * 100, 3)}%`);
}

function asFloat(num: number): string {
	return pad(roundTo(num));
}

function formatSummarizedMeasure(measure: SummarizedMeasurement | undefined, fmt: (num: number) => string = asFloat) {
	if(measure === undefined) {
		return '??';
	}
	return `${fmt(measure.min)} - ${fmt(measure.max)} (median: ${fmt(measure.median)}, mean: ${fmt(measure.mean)}, std: ${fmt(measure.std)})`;
}

function inputAndDataflow2String<T>(input: SlicerStatsInput<T>, dataflow: SlicerStatsDataflow<T>, fmt: (value: T) => string, bytes: (value: T) => string): string {
	return `Input:
  Number of lines:                     ${fmt(input.numberOfLines)}
  Number of non empty lines:           ${fmt(input.numberOfNonEmptyLines)}
  Number of characters:                ${fmt(input.numberOfCharacters)}
  Number of characters (w/o comments): ${fmt(input.numberOfCharactersNoComments)}
  Number of non whitespace characters: ${fmt(input.numberOfNonWhitespaceCharacters)}
  Number of n. w. c. (w/o comments):   ${fmt(input.numberOfNonWhitespaceCharactersNoComments)}
  Number of tokens:                    ${fmt(input.numberOfRTokens)}
  Number of tokens (w/o comments):     ${fmt(input.numberOfRTokensNoComments)}
  Normalized R tokens:                 ${fmt(input.numberOfNormalizedTokens)}
  Normalized R tokens (w/o comments):  ${fmt(input.numberOfNormalizedTokensNoComments)}

Dataflow:
  Number of nodes:               ${fmt(dataflow.numberOfNodes)}
  Number of edges:               ${fmt(dataflow.numberOfEdges)}
  Number of control flow edges:  ${fmt(dataflow.numberOfControlFlowEdges)}
  Number of calls:               ${fmt(dataflow.numberOfCalls)}
  Number of function defs:       ${fmt(dataflow.numberOfFunctionDefinitions)}
  Size of graph:                 ${bytes(dataflow.sizeOfObject)}`;
}

function printSummarizedMeasurements(stats: SummarizedPerSliceStats, key: PerSliceMeasurements): string {
	const measure = stats.measurements.get(key);
	guard(measure !== undefined, `Measurement for ${JSON.stringify(key)} not found`);
	return formatSummarizedTimeMeasure(measure);
}

function printCountSummarizedMeasurements(stats: SummarizedMeasurement): string {
	const range = `${stats.min} - ${stats.max}`.padStart(padSize, ' ');
	return `${range} (median: ${stats.median}, mean: ${stats.mean}, std: ${stats.std})`;
}

const units = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

// based on https://stackoverflow.com/a/39906526
function convertNumberToNiceBytes(x: number) {
	let n = Math.abs(x);
	let l = 0;
	while(n >= 1024 && ++l) {
		n = n / 1024;
	}
	return pad((x < 0 ? '-' : '') + n.toFixed(n < 10 && l > 0 ? 1 : 0) + ' ' + units[l]);
}

/** The phases every run times per token, by label, measurement, and the field holding the time per token; the optional ones only print when measured. */
const TokenPhases = [['AST retrieval', 'retrieve AST from R code', 'retrieveTimePerToken'], ['AST normalization', 'normalize R AST', 'normalizeTimePerToken'], ['Dataflow creation', 'produce dataflow information', 'dataflowTimePerToken']] as const;
const OptionalTokenPhases = [['Control flow extraction', 'extract control flow graph', 'controlFlowTimePerToken'], ['Call graph extraction', 'extract call graph', 'callGraphTimePerToken'], ['Dataframe shape inference', 'infer data frame shapes', 'dataFrameShapeTimePerToken']] as const;
type PhaseKey = (typeof TokenPhases | typeof OptionalTokenPhases)[number][2] | 'totalCommonTimePerToken';

/** The time of each phase and its time per token, a phase timed by `time`, a time per token formatted by `format`. */
function phases2String<T>(stats: { readonly commonMeasurements: ReadonlyMap<CommonSlicerMeasurements, unknown> } & { readonly [K in PhaseKey]?: TimePerToken<T> }, time: (phase: CommonSlicerMeasurements) => string, format: (value: T) => string): string {
	const line = (label: string, value: string) => `\n${(label + ':').padEnd(38)}${value}`;
	const perToken = (label: string, of: TimePerToken<T> | undefined) => of === undefined ? '' : line(label + ' per token', format(of.normalized)) + line(label + ' per R token', format(of.raw));
	const phase = ([label, measurement, key]: readonly [string, CommonSlicerMeasurements, PhaseKey]) => line(label, time(measurement)) + perToken(label, stats[key]);
	return line('Shell init time', time('initialize R session')) + TokenPhases.map(phase).join('') + perToken('Total common time', stats.totalCommonTimePerToken)
		+ OptionalTokenPhases.filter(([, measurement, key]) => stats.commonMeasurements.has(measurement) && stats[key] !== undefined).map(phase).join('');
}

/** Converts the given stats to a human-readable string. You may have to {@link summarizeSlicerStats | summarize} the stats first. */
export function stats2string(stats: SummarizedSlicerStats): string {
	let result = `
Request: ${JSON.stringify(stats.request)}${phases2String(stats, key => print(stats.commonMeasurements, key), formatNanoseconds)}`;

	if(stats.perSliceMeasurements.numberOfSlices > 0) {
		result += `

Slicing summary for ${stats.perSliceMeasurements.numberOfSlices} slice${stats.perSliceMeasurements.numberOfSlices !== 1 ? 's' : ''}:
  Total:                              ${printSummarizedMeasurements(stats.perSliceMeasurements, 'total')}
  Slice creation:                     ${printSummarizedMeasurements(stats.perSliceMeasurements, 'static slicing')}
  Slice creation per token in slice:  ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.sliceTimePerToken.normalized)}
  Slice creation per R token in slice:${formatSummarizedTimeMeasure(stats.perSliceMeasurements.sliceTimePerToken.raw)}
  Reconstruction:                     ${printSummarizedMeasurements(stats.perSliceMeasurements, 'reconstruct code')}
  Reconstruction per token in slice:  ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.reconstructTimePerToken.normalized)}
  Reconstruction per R token in slice:${formatSummarizedTimeMeasure(stats.perSliceMeasurements.reconstructTimePerToken.raw)}
  Total per token in slice:           ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.totalPerSliceTimePerToken.normalized)}
  Total per R token in slice:         ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.totalPerSliceTimePerToken.raw)}
  Used Slice Criteria Sizes:          ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceCriteriaSizes)}
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
    Number of dataflow nodes:            ${printCountSummarizedMeasurements(stats.perSliceMeasurements.sliceSize.dataflowNodes)}`;
	}

	result += `

Shell close:                         ${print(stats.commonMeasurements, 'close R session')}
Total:                               ${print(stats.commonMeasurements, 'total')}

${inputAndDataflow2String(stats.input, stats.dataflow, pad, convertNumberToNiceBytes)}`;

	if(stats.dataFrameShape !== undefined) {
		result += `

Dataframe shape inference:
  Number of resulting constraints:${pad(stats.dataFrameShape.numberOfResultConstraints)}
  Number of operation nodes:      ${pad(stats.dataFrameShape.numberOfOperationNodes)}
  Number of abstract value nodes: ${pad(stats.dataFrameShape.numberOfValueNodes)}
  Number of entries per node:     ${pad(stats.dataFrameShape.numberOfEntriesPerNode.mean)}
  Number of operations:           ${pad(stats.dataFrameShape.numberOfOperations)}
  Number of total values:         ${pad(stats.dataFrameShape.numberOfTotalValues)}
  Number of total top:            ${pad(stats.dataFrameShape.numberOfTotalTop)}
  Inferred column names per node: ${pad(stats.dataFrameShape.inferredColNames.mean)}
  Number of column names values:  ${pad(stats.dataFrameShape.numberOfColNamesValues)}
  Number of column names infinite:${pad(stats.dataFrameShape.numberOfColNamesInfinite)}
  Number of column names top:     ${pad(stats.dataFrameShape.numberOfColNamesTop)}
  Inferred column count per node: ${pad(stats.dataFrameShape.inferredColCount.mean)}
  Number of column count values:  ${pad(stats.dataFrameShape.numberOfColCountValues)}
  Number of column count infinite:${pad(stats.dataFrameShape.numberOfColCountInfinite)}
  Number of column count top:     ${pad(stats.dataFrameShape.numberOfColCountTop)}
  Inferred row count per node:    ${pad(stats.dataFrameShape.inferredRowCount.mean)}
  Number of row count values:     ${pad(stats.dataFrameShape.numberOfRowCountValues)}
  Number of row count infinite:   ${pad(stats.dataFrameShape.numberOfRowCountInfinite)}
  Number of row count top:        ${pad(stats.dataFrameShape.numberOfRowCountTop)}
  Size of data frame shape info:  ${convertNumberToNiceBytes(stats.dataFrameShape.sizeOfInfo)}`;
	}

	return result;
}

/** Converts reduction stats to a human-readable string. */
export function ultimateStats2String(stats: UltimateSlicerStats): string {
	let result = `
Summarized: ${stats.totalRequests} requests and ${stats.totalSlices} slices${phases2String(stats, key => formatSummarizedTimeMeasure(stats.commonMeasurements.get(key)), formatSummarizedTimeMeasure)}`;

	result += `

Per 100 lines of input:
  AST retrieval:                      ${formatSummarizedTimeMeasure(stats.retrieveTimePer100Lines)}
  AST normalization:                  ${formatSummarizedTimeMeasure(stats.normalizeTimePer100Lines)}
  Dataflow creation:                  ${formatSummarizedTimeMeasure(stats.dataflowTimePer100Lines)}
  Control flow extraction:            ${formatSummarizedTimeMeasure(stats.controlFlowTimePer100Lines)}
  Total common:                       ${formatSummarizedTimeMeasure(stats.totalCommonTimePer100Lines)}
  Slice creation:                     ${formatSummarizedTimeMeasure(stats.sliceTimePer100Lines)}
  Reconstruction:                     ${formatSummarizedTimeMeasure(stats.reconstructTimePer100Lines)}
  Total per slice:                    ${formatSummarizedTimeMeasure(stats.totalPerSliceTimePer100Lines)}`;

	if(stats.additionalMeasurements !== undefined && stats.additionalMeasurements.size > 0) {
		result += `

Additional phases (not part of the total):`;
		for(const [name, measure] of stats.additionalMeasurements) {
			result += `
  ${name.padEnd(34, ' ')}${formatSummarizedTimeMeasure(measure)}`;
		}
	}

	// Used Slice Criteria Sizes: ${formatSummarizedMeasure(stats.perSliceMeasurements.sliceCriteriaSizes)}
	if(stats.totalSlices > 0) {
		result += `

Slicing summary for ${stats.totalSlices} slice${stats.totalSlices !== 1 ? 's' : ''}:
  Total:                              ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.get('total'))}
  Slice creation:                     ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.get('static slicing'))}
  Slice creation per token in slice:  ${formatSummarizedTimeMeasure(stats.sliceTimePerToken.normalized)}
  Slice creation per R token in slice:${formatSummarizedTimeMeasure(stats.sliceTimePerToken.raw)}
  Reconstruction:                     ${formatSummarizedTimeMeasure(stats.perSliceMeasurements.get('reconstruct code'))}
  Reconstruction per token in slice:  ${formatSummarizedTimeMeasure(stats.reconstructTimePerToken.normalized)}
  Reconstruction per R token in slice:${formatSummarizedTimeMeasure(stats.reconstructTimePerToken.raw)}
  Total per token in slice:           ${formatSummarizedTimeMeasure(stats.totalPerSliceTimePerToken.normalized)}
  Total per R token in slice:         ${formatSummarizedTimeMeasure(stats.totalPerSliceTimePerToken.raw)}
  Failed to Re-Parse:                 ${pad(stats.failedToRepParse)}/${stats.totalSlices}
  Times hit Threshold:                ${pad(stats.timesHitThreshold)}/${stats.totalSlices}
${reduction2String('Reductions', stats.reduction)}
${reduction2String('Reductions without comments and empty lines', stats.reductionNoFluff)}`;
	}

	result += `

Shell close:                        ${formatSummarizedTimeMeasure(stats.commonMeasurements.get('close R session'))}
Total:                              ${formatSummarizedTimeMeasure(stats.commonMeasurements.get('total'))}

${inputAndDataflow2String(stats.input, stats.dataflow, m => formatSummarizedMeasure(m), m => formatSummarizedMeasure(m, convertNumberToNiceBytes))}`;

	if(stats.dataFrameShape !== undefined) {
		result += `

Dataframe shape inference:
  Number of resulting constraints:${formatSummarizedMeasure(stats.dataFrameShape.numberOfResultConstraints)}
  Number of operation nodes:      ${formatSummarizedMeasure(stats.dataFrameShape.numberOfOperationNodes)}
  Number of abstract value nodes: ${formatSummarizedMeasure(stats.dataFrameShape.numberOfValueNodes)}
  Number of entries per node:     ${formatSummarizedMeasure(stats.dataFrameShape.numberOfEntriesPerNode)}
  Number of operations:           ${formatSummarizedMeasure(stats.dataFrameShape.numberOfOperations)}
  Number of total exact:          ${formatSummarizedMeasure(stats.dataFrameShape.numberOfTotalExact)}
  Number of total values:         ${formatSummarizedMeasure(stats.dataFrameShape.numberOfTotalValues)}
  Number of total top:            ${formatSummarizedMeasure(stats.dataFrameShape.numberOfTotalTop)}
  Inferred column names per node: ${formatSummarizedMeasure(stats.dataFrameShape.inferredColNames)}
  Number of column names exact:   ${formatSummarizedMeasure(stats.dataFrameShape.numberOfColNamesExact)}
  Number of column names values:  ${formatSummarizedMeasure(stats.dataFrameShape.numberOfColNamesValues)}
  Number of column names infinite:${formatSummarizedMeasure(stats.dataFrameShape.numberOfColNamesInfinite)}
  Number of column names top:     ${formatSummarizedMeasure(stats.dataFrameShape.numberOfColNamesTop)}
  Inferred column count per node: ${formatSummarizedMeasure(stats.dataFrameShape.inferredColCount)}
  Number of column count exact:   ${formatSummarizedMeasure(stats.dataFrameShape.numberOfColCountExact)}
  Number of column count values:  ${formatSummarizedMeasure(stats.dataFrameShape.numberOfColCountValues)}
  Number of column count infinite:${formatSummarizedMeasure(stats.dataFrameShape.numberOfColCountInfinite)}
  Number of column count top:     ${formatSummarizedMeasure(stats.dataFrameShape.numberOfColCountTop)}
  Inferred row count per node:    ${formatSummarizedMeasure(stats.dataFrameShape.inferredRowCount)}
  Number of row count exact:      ${formatSummarizedMeasure(stats.dataFrameShape.numberOfRowCountExact)}
  Number of row count values:     ${formatSummarizedMeasure(stats.dataFrameShape.numberOfRowCountValues)}
  Number of row count infinite:   ${formatSummarizedMeasure(stats.dataFrameShape.numberOfRowCountInfinite)}
  Number of row count top:        ${formatSummarizedMeasure(stats.dataFrameShape.numberOfRowCountTop)}
  Size of data frame shape info:  ${formatSummarizedMeasure(stats.dataFrameShape.sizeOfInfo, convertNumberToNiceBytes)}`;
	}

	return result;
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
    Number of dataflow nodes:            ${formatSummarizedMeasure(reduction.numberOfDataflowNodes, asPercentage)}`;
}
