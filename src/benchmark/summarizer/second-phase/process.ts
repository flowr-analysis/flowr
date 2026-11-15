import type { SummarizedDfShapeStats, SummarizedSlicerStats, UltimateSlicerStats } from '../data';
import { summarizeSummarizedReductions, summarizeSummarizedMeasurement, summarizeSummarizedTimePerToken, summarizeTimePerToken } from '../first-phase/process';
import { DefaultMap } from '../../../util/collections/defaultmap';
import { type SummarizedMeasurement, summarizeMeasurement } from '../../../util/summarizer';
import { guard, isNotUndefined } from '../../../util/assert';
import {
	type BenchmarkMemoryMeasurement,
	type SlicerStatsDataflow,
	type SlicerStatsInput,
	AdditionalSlicerMeasurements,
	CommonSlicerMeasurements,
	PerSliceMeasurements
} from '../../stats/stats';
import { DataFrameOperationNames } from '../../../abstract-interpretation/data-frame/semantics';
import { arraySum } from '../../../util/collections/arrays';

/** The keys `keys` of `T`, which have to be all of them. */
function allKeys<T>(): <const K extends readonly (keyof T)[]>(keys: [keyof T] extends [K[number]] ? K : never) => K {
	return keys => keys;
}
const InputKeys = allKeys<SlicerStatsInput>()(['numberOfLines', 'numberOfNonEmptyLines', 'numberOfCharacters', 'numberOfCharactersNoComments', 'numberOfNonWhitespaceCharacters',
	'numberOfNonWhitespaceCharactersNoComments', 'numberOfRTokens', 'numberOfRTokensNoComments', 'numberOfNormalizedTokens', 'numberOfNormalizedTokensNoComments']);
const DataflowKeys = allKeys<SlicerStatsDataflow>()(['numberOfNodes', 'numberOfFunctionDefinitions', 'numberOfCalls', 'numberOfEdges', 'numberOfControlFlowEdges', 'sizeOfObject']);

/** Each of the fields `keys` of the objects `of` summarized by `summarize`. */
function summarizeFields<O, K extends keyof O, R>(of: readonly O[], keys: readonly K[], summarize: (values: O[K][]) => R): Record<K, R> {
	return Object.fromEntries(keys.map(k => [k, summarize(of.map(o => o[k]))])) as Record<K, R>;
}

/** The fields of a data frame shape summary in the order they are written, `perOperationNumber` aside; a few are summed or are summaries already. */
const DfShapeKeys = allKeys<Omit<SummarizedDfShapeStats, 'perOperationNumber'>>()([
	'numberOfDataFrameFiles', 'numberOfNonDataFrameFiles', 'numberOfResultConstraints', 'numberOfResultingValues', 'numberOfResultingBottom',
	'numberOfResultingTop', 'numberOfEmptyNodes', 'numberOfOperationNodes', 'numberOfValueNodes', 'sizeOfInfo', 'numberOfEntriesPerNode',
	'numberOfOperations', 'numberOfTotalConstraints', 'numberOfTotalExact', 'numberOfTotalValues', 'numberOfTotalBottom', 'numberOfTotalTop',
	'inferredColNames', 'approxRangeColNames', 'numberOfColNamesExact', 'numberOfColNamesValues', 'numberOfColNamesBottom', 'numberOfColNamesInfinite',
	'numberOfColNamesTop', 'inferredColCount', 'approxRangeColCount', 'numberOfColCountExact', 'numberOfColCountValues', 'numberOfColCountBottom',
	'numberOfColCountInfinite', 'numberOfColCountTop', 'inferredRowCount', 'approxRangeRowCount', 'numberOfRowCountExact', 'numberOfRowCountValues',
	'numberOfRowCountBottom', 'numberOfRowCountInfinite', 'numberOfRowCountTop'
]);
const SummedShapeKeys: ReadonlySet<string> = new Set(['numberOfDataFrameFiles', 'numberOfNonDataFrameFiles']);
const SummaryShapeKeys: ReadonlySet<string> = new Set(['numberOfEntriesPerNode', 'inferredColNames', 'approxRangeColNames', 'inferredColCount', 'approxRangeColCount', 'inferredRowCount', 'approxRangeRowCount']);

/** The data frame shapes summarized field by field, the measured fields by `measure`, `undefined` if no run has one. */
function summarizeShapes<T, S>(shapes: readonly (SummarizedDfShapeStats<T> | undefined)[], measure: (values: T[]) => S, rest: Pick<SummarizedDfShapeStats<S>, 'perOperationNumber'>): SummarizedDfShapeStats<S> | undefined {
	const present = shapes.filter(isNotUndefined);
	if(present.length === 0) {
		return undefined;
	}
	function field(k: typeof DfShapeKeys[number]) {
		const values = present.map(p => p[k]).filter(isNotUndefined);
		return SummedShapeKeys.has(k) ? arraySum(values as number[]) : SummaryShapeKeys.has(k) ? summarizeSummarizedMeasurement(values as SummarizedMeasurement[]) : measure(values as T[]);
	}
	return { ...Object.fromEntries(DfShapeKeys.map(k => [k, field(k)])), ...rest } as SummarizedDfShapeStats<S>;
}

/** This big function summarizes multiple summarized stats into one ultimate stat. */
export function summarizeAllSummarizedStats(stats: SummarizedSlicerStats[]): UltimateSlicerStats {
	const commonMeasurements = new DefaultMap<CommonSlicerMeasurements, number[]>(() => []);
	const perSliceMeasurements = new DefaultMap<PerSliceMeasurements, SummarizedMeasurement[]>(() => []);
	const additionalMeasurements = new DefaultMap<AdditionalSlicerMeasurements, number[]>(() => []);
	for(const stat of stats) {
		for(const [k, v] of stat.commonMeasurements) {
			commonMeasurements.get(k).push(Number(v));
		}
		for(const [k, v] of stat.perSliceMeasurements.measurements) {
			perSliceMeasurements.get(k).push(v);
		}
		for(const [k, v] of stat.additionalMeasurements ?? []) {
			additionalMeasurements.get(k).push(Number(v));
		}
	}
	const perSlice = stats.map(s => s.perSliceMeasurements);
	function optional<T, R>(values: readonly (T | undefined)[], summarize: (present: T[]) => R): R | undefined {
		const present = values.filter(isNotUndefined);
		return present.length > 0 ? summarize(present) : undefined;
	}
	const inputs = stats.map(s => s.input);
	const dataflows = stats.map(s => s.dataflow);
	const sum = (f: (s: SummarizedSlicerStats['perSliceMeasurements']) => number) => arraySum(perSlice.map(f));

	return {
		totalRequests:      stats.length,
		totalSlices:        sum(p => p.numberOfSlices),
		commonMeasurements: new Map(
			[...commonMeasurements.entries()].map(([k, v]) => [k, summarizeMeasurement(v)])
		),
		perSliceMeasurements: new Map(
			[...perSliceMeasurements.entries()].map(([k, v]) => [k, summarizeSummarizedMeasurement(v)])
		),
		additionalMeasurements: new Map(
			[...additionalMeasurements.entries()].map(([k, v]) => [k, summarizeMeasurement(v)])
		),
		sliceTimePerToken:            summarizeSummarizedTimePerToken(perSlice.map(p => p.sliceTimePerToken)),
		reconstructTimePerToken:      summarizeSummarizedTimePerToken(perSlice.map(p => p.reconstructTimePerToken)),
		totalPerSliceTimePerToken:    summarizeSummarizedTimePerToken(perSlice.map(p => p.totalPerSliceTimePerToken)),
		retrieveTimePerToken:         summarizeTimePerToken(stats.map(s => s.retrieveTimePerToken)),
		normalizeTimePerToken:        summarizeTimePerToken(stats.map(s => s.normalizeTimePerToken)),
		dataflowTimePerToken:         summarizeTimePerToken(stats.map(s => s.dataflowTimePerToken)),
		totalCommonTimePerToken:      summarizeTimePerToken(stats.map(s => s.totalCommonTimePerToken)),
		controlFlowTimePerToken:      optional(stats.map(s => s.controlFlowTimePerToken), summarizeTimePerToken),
		callGraphTimePerToken:        optional(stats.map(s => s.callGraphTimePerToken), summarizeTimePerToken),
		dataFrameShapeTimePerToken:   optional(stats.map(s => s.dataFrameShapeTimePerToken), summarizeTimePerToken),
		retrieveTimePer100Lines:      summarizeMeasurement(stats.map(s => s.retrieveTimePer100Lines)),
		normalizeTimePer100Lines:     summarizeMeasurement(stats.map(s => s.normalizeTimePer100Lines)),
		dataflowTimePer100Lines:      summarizeMeasurement(stats.map(s => s.dataflowTimePer100Lines)),
		totalCommonTimePer100Lines:   summarizeMeasurement(stats.map(s => s.totalCommonTimePer100Lines)),
		controlFlowTimePer100Lines:   optional(stats.map(s => s.controlFlowTimePer100Lines), summarizeMeasurement),
		sliceTimePer100Lines:         summarizeSummarizedMeasurement(perSlice.map(p => p.sliceTimePer100Lines)),
		reconstructTimePer100Lines:   summarizeSummarizedMeasurement(perSlice.map(p => p.reconstructTimePer100Lines)),
		totalPerSliceTimePer100Lines: summarizeSummarizedMeasurement(perSlice.map(p => p.totalPerSliceTimePer100Lines)),
		failedToRepParse:             sum(p => p.failedToRepParse),
		timesHitThreshold:            sum(p => p.timesHitThreshold),
		reduction:                    summarizeSummarizedReductions(perSlice.map(p => p.reduction)),
		reductionNoFluff:             summarizeSummarizedReductions(perSlice.map(p => p.reductionNoFluff)),
		input:                        summarizeFields(inputs, InputKeys, summarizeMeasurement),
		dataflow:                     summarizeFields(dataflows.map(d => ({ ...d, numberOfControlFlowEdges: d.numberOfControlFlowEdges ?? 0 })), DataflowKeys, summarizeMeasurement),
		controlFlow:                  stats.some(s => s.controlFlow !== undefined) ? {
			numberOfVertices: summarizeMeasurement(stats.map(s => s.controlFlow?.numberOfVertices).filter(isNotUndefined)),
			numberOfEdges:    summarizeMeasurement(stats.map(s => s.controlFlow?.numberOfEdges).filter(isNotUndefined)),
			sizeOfObject:     summarizeMeasurement(stats.map(s => s.controlFlow?.sizeOfObject).filter(isNotUndefined))
		} : undefined,
		dataFrameShape: summarizeShapes(stats.map(s => s.dataFrameShape), summarizeMeasurement, {
			perOperationNumber: new Map(DataFrameOperationNames.map(n => [n, summarizeMeasurement(stats.map(s => s.dataFrameShape?.perOperationNumber.get(n) ?? 0))]))
		})
	};
}

/** This big function summarizes multiple ultimate stats into one. */
export function summarizeAllUltimateStats(stats: UltimateSlicerStats[]): UltimateSlicerStats {
	return {
		// these should be deterministic, so we don't technically need to use max, but we do just in case something unexpected happens :)
		totalRequests:                Math.max(...stats.map(s => s.totalRequests)),
		totalSlices:                  Math.max(...stats.map(s => s.totalSlices)),
		failedToRepParse:             Math.max(...stats.map(s => s.failedToRepParse)),
		timesHitThreshold:            Math.max(...stats.map(s => s.timesHitThreshold)),
		// average out / summarize other measurements
		commonMeasurements:           new Map(CommonSlicerMeasurements.filter(m => stats.some(s => s.commonMeasurements.has(m))).map(m => [m, summarizeSummarizedMeasurement(stats.map(s => s.commonMeasurements.get(m) as SummarizedMeasurement))])),
		perSliceMeasurements:         new Map(PerSliceMeasurements.map(m => [m, summarizeSummarizedMeasurement(stats.map(s => s.perSliceMeasurements.get(m) as SummarizedMeasurement))])),
		additionalMeasurements:       new Map(AdditionalSlicerMeasurements.filter(m => stats.some(s => s.additionalMeasurements?.has(m))).map(m => [m, summarizeSummarizedMeasurement(stats.map(s => s.additionalMeasurements?.get(m)).filter(isNotUndefined))])),
		sliceTimePerToken:            summarizeSummarizedTimePerToken(stats.map(s => s.sliceTimePerToken)),
		reconstructTimePerToken:      summarizeSummarizedTimePerToken(stats.map(s => s.reconstructTimePerToken)),
		totalPerSliceTimePerToken:    summarizeSummarizedTimePerToken(stats.map(s => s.totalPerSliceTimePerToken)),
		retrieveTimePerToken:         summarizeSummarizedTimePerToken(stats.map(s => s.retrieveTimePerToken)),
		normalizeTimePerToken:        summarizeSummarizedTimePerToken(stats.map(s => s.normalizeTimePerToken)),
		dataflowTimePerToken:         summarizeSummarizedTimePerToken(stats.map(s => s.dataflowTimePerToken)),
		totalCommonTimePerToken:      summarizeSummarizedTimePerToken(stats.map(s => s.totalCommonTimePerToken)),
		controlFlowTimePerToken:      stats.some(s => s.controlFlowTimePerToken !== undefined) ? summarizeSummarizedTimePerToken(stats.map(s => s.controlFlowTimePerToken).filter(isNotUndefined)) : undefined,
		dataFrameShapeTimePerToken:   stats.some(s => s.dataFrameShapeTimePerToken !== undefined) ? summarizeSummarizedTimePerToken(stats.map(s => s.dataFrameShapeTimePerToken).filter(isNotUndefined)) : undefined,
		retrieveTimePer100Lines:      summarizeSummarizedMeasurement(stats.map(s => s.retrieveTimePer100Lines).filter(isNotUndefined)),
		normalizeTimePer100Lines:     summarizeSummarizedMeasurement(stats.map(s => s.normalizeTimePer100Lines).filter(isNotUndefined)),
		dataflowTimePer100Lines:      summarizeSummarizedMeasurement(stats.map(s => s.dataflowTimePer100Lines).filter(isNotUndefined)),
		totalCommonTimePer100Lines:   summarizeSummarizedMeasurement(stats.map(s => s.totalCommonTimePer100Lines).filter(isNotUndefined)),
		controlFlowTimePer100Lines:   stats.some(s => s.controlFlowTimePer100Lines !== undefined) ? summarizeSummarizedMeasurement(stats.map(s => s.controlFlowTimePer100Lines).filter(isNotUndefined)) : undefined,
		sliceTimePer100Lines:         summarizeSummarizedMeasurement(stats.map(s => s.sliceTimePer100Lines).filter(isNotUndefined)),
		reconstructTimePer100Lines:   summarizeSummarizedMeasurement(stats.map(s => s.reconstructTimePer100Lines).filter(isNotUndefined)),
		totalPerSliceTimePer100Lines: summarizeSummarizedMeasurement(stats.map(s => s.totalPerSliceTimePer100Lines).filter(isNotUndefined)),
		reduction:                    summarizeSummarizedReductions(stats.map(s => s.reduction)),
		reductionNoFluff:             summarizeSummarizedReductions(stats.map(s => s.reductionNoFluff)),
		input:                        summarizeFields(stats.map(s => s.input), InputKeys, summarizeSummarizedMeasurement),
		dataflow:                     summarizeFields(stats.map(s => s.dataflow), DataflowKeys, summarizeSummarizedMeasurement),
		controlFlow:                  stats.some(s => s.controlFlow !== undefined) ? {
			numberOfVertices: summarizeSummarizedMeasurement(stats.map(s => s.controlFlow?.numberOfVertices).filter(isNotUndefined)),
			numberOfEdges:    summarizeSummarizedMeasurement(stats.map(s => s.controlFlow?.numberOfEdges).filter(isNotUndefined)),
			sizeOfObject:     summarizeSummarizedMeasurement(stats.map(s => s.controlFlow?.sizeOfObject).filter(isNotUndefined))
		} : undefined,
		dataFrameShape: summarizeShapes(stats.map(s => s.dataFrameShape), summarizeSummarizedMeasurement, {
			perOperationNumber: new Map(DataFrameOperationNames.map(n => [n, summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.perOperationNumber.get(n)).filter(isNotUndefined))]))
		})
	};
}

/** Restores the maps and bigints of serialized measurements. */
export function restoreMeasurementMaps(stats: object) {
	const { memory, commonMeasurements, additionalMeasurements } = stats as {
		memory:                 [CommonSlicerMeasurements, BenchmarkMemoryMeasurement][],
		commonMeasurements:     [CommonSlicerMeasurements, string][],
		additionalMeasurements: [AdditionalSlicerMeasurements, string][] | undefined
	};
	const bigints = <K>(entries: readonly (readonly [K, string])[]) => new Map(entries.map(([k, v]) => {
		guard(v.endsWith('n'), 'Expected a bigint');
		return [k, BigInt(v.slice(0, -1))] as const;
	}));
	return {
		memory:                 new Map(memory),
		commonMeasurements:     bigints(commonMeasurements),
		additionalMeasurements: bigints(additionalMeasurements ?? [])
	};
}

/** Processes the next summary line. */
export function processNextSummary(line: Buffer, allSummarized: SummarizedSlicerStats[]): void {
	let got = JSON.parse(line.toString()) as { summarize: SummarizedSlicerStats };
	got = {
		summarize: {
			...got.summarize,
			// restore maps
			...restoreMeasurementMaps(got.summarize),
			perSliceMeasurements: {
				...got.summarize.perSliceMeasurements,
				// restore maps
				measurements: new Map(got.summarize.perSliceMeasurements.measurements),
			},
			dataFrameShape: got.summarize.dataFrameShape !== undefined ? {
				...got.summarize.dataFrameShape,
				perOperationNumber: new Map(got.summarize.dataFrameShape.perOperationNumber)
			} : undefined
		}
	};
	allSummarized.push(got.summarize);
}

/** Processes the next ultimate summary line. */
export function processNextUltimateSummary(line: Buffer, allSummarized: UltimateSlicerStats[]): void {
	let got = JSON.parse(line.toString()) as UltimateSlicerStats;
	got = {
		...got,
		// restore maps
		commonMeasurements:     new Map(got.commonMeasurements),
		perSliceMeasurements:   new Map(got.perSliceMeasurements),
		additionalMeasurements: new Map(got.additionalMeasurements ?? []),
		dataFrameShape:         got.dataFrameShape !== undefined ? {
			...got.dataFrameShape,
			perOperationNumber: new Map(got.dataFrameShape.perOperationNumber)
		} : undefined
	};
	allSummarized.push(got);
}
