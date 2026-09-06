import type { Reduction, SummarizedDfShapeStats, SummarizedSlicerStats, TimePerToken, UltimateSlicerStats } from '../data';
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

/**
 * This big function summarizes multiple summarized stats into one ultimate stat.
 */
export function summarizeAllSummarizedStats(stats: SummarizedSlicerStats[]): UltimateSlicerStats {
	const commonMeasurements = new DefaultMap<CommonSlicerMeasurements, number[]>(() => []);
	const perSliceMeasurements = new DefaultMap<PerSliceMeasurements, SummarizedMeasurement[]>(() => []);
	const additionalMeasurements = new DefaultMap<AdditionalSlicerMeasurements, number[]>(() => []);
	const retrieveTimesPer100Lines: number[] = [];
	const normalizeTimesPer100Lines: number[] = [];
	const dataflowTimesPer100Lines: number[] = [];
	const totalCommonTimesPer100Lines: number[] = [];
	const controlFlowTimesPer100Lines: number[] = [];
	const sliceTimesPer100Lines: SummarizedMeasurement[] = [];
	const reconstructTimesPer100Lines: SummarizedMeasurement[] = [];
	const totalPerSliceTimesPer100Lines: SummarizedMeasurement[] = [];
	const sliceTimesPerToken: TimePerToken[] = [];
	const reconstructTimesPerToken: TimePerToken[] = [];
	const totalPerSliceTimesPerToken: TimePerToken[] = [];
	const retrieveTimesPerToken: TimePerToken<number>[] = [];
	const normalizeTimesPerToken: TimePerToken<number>[] = [];
	const dataflowTimesPerToken: TimePerToken<number>[] = [];
	const totalCommonTimesPerToken: TimePerToken<number>[] = [];
	const controlFlowTimePerToken: TimePerToken<number>[] = [];
	const callGraphTimePerToken: TimePerToken<number>[] = [];
	const dataFrameShapeTimePerToken: TimePerToken<number>[] = [];
	const memory = new DefaultMap<CommonSlicerMeasurements, BenchmarkMemoryMeasurement[]>(() => []);
	const reductions: Reduction<SummarizedMeasurement>[] = [];
	const reductionsNoFluff: Reduction<SummarizedMeasurement>[] = [];
	const inputs: SlicerStatsInput[] = [];
	const dataflows: SlicerStatsDataflow[] = [];
	const dataFrameShapes: SummarizedDfShapeStats[] = [];
	let failedToRepParse = 0;
	let timesHitThreshold = 0;
	let totalSlices = 0;

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
		retrieveTimesPer100Lines.push(stat.retrieveTimePer100Lines);
		normalizeTimesPer100Lines.push(stat.normalizeTimePer100Lines);
		dataflowTimesPer100Lines.push(stat.dataflowTimePer100Lines);
		totalCommonTimesPer100Lines.push(stat.totalCommonTimePer100Lines);
		if(stat.controlFlowTimePer100Lines !== undefined) {
			controlFlowTimesPer100Lines.push(stat.controlFlowTimePer100Lines);
		}
		sliceTimesPer100Lines.push(stat.perSliceMeasurements.sliceTimePer100Lines);
		reconstructTimesPer100Lines.push(stat.perSliceMeasurements.reconstructTimePer100Lines);
		totalPerSliceTimesPer100Lines.push(stat.perSliceMeasurements.totalPerSliceTimePer100Lines);
		sliceTimesPerToken.push(stat.perSliceMeasurements.sliceTimePerToken);
		reconstructTimesPerToken.push(stat.perSliceMeasurements.reconstructTimePerToken);
		totalPerSliceTimesPerToken.push(stat.perSliceMeasurements.totalPerSliceTimePerToken);
		retrieveTimesPerToken.push(stat.retrieveTimePerToken);
		normalizeTimesPerToken.push(stat.normalizeTimePerToken);
		dataflowTimesPerToken.push(stat.dataflowTimePerToken);
		totalCommonTimesPerToken.push(stat.totalCommonTimePerToken);

		if(stat.controlFlowTimePerToken !== undefined) {
			controlFlowTimePerToken.push(stat.controlFlowTimePerToken);
		}
		if(stat.callGraphTimePerToken !== undefined) {
			callGraphTimePerToken.push(stat.callGraphTimePerToken);
		}
		if(stat.dataFrameShapeTimePerToken !== undefined) {
			dataFrameShapeTimePerToken.push(stat.dataFrameShapeTimePerToken);
		}
		for(const [k, v] of stat.memory) {
			memory.get(k).push(v);
		}
		reductions.push(stat.perSliceMeasurements.reduction);
		reductionsNoFluff.push(stat.perSliceMeasurements.reductionNoFluff);
		inputs.push(stat.input);
		dataflows.push(stat.dataflow);

		if(stat.dataFrameShape !== undefined) {
			dataFrameShapes.push(stat.dataFrameShape);
		}
		failedToRepParse += stat.perSliceMeasurements.failedToRepParse;
		totalSlices += stat.perSliceMeasurements.numberOfSlices;
		timesHitThreshold += stat.perSliceMeasurements.timesHitThreshold;
	}

	return {
		totalRequests:      stats.length,
		totalSlices:        totalSlices,
		commonMeasurements: new Map(
			[...commonMeasurements.entries()].map(([k, v]) => [k, summarizeMeasurement(v)])
		),
		perSliceMeasurements: new Map(
			[...perSliceMeasurements.entries()].map(([k, v]) => [k, summarizeSummarizedMeasurement(v)])
		),
		additionalMeasurements: new Map(
			[...additionalMeasurements.entries()].map(([k, v]) => [k, summarizeMeasurement(v)])
		),
		sliceTimePerToken:            summarizeSummarizedTimePerToken(sliceTimesPerToken),
		reconstructTimePerToken:      summarizeSummarizedTimePerToken(reconstructTimesPerToken),
		totalPerSliceTimePerToken:    summarizeSummarizedTimePerToken(totalPerSliceTimesPerToken),
		retrieveTimePerToken:         summarizeTimePerToken(retrieveTimesPerToken),
		normalizeTimePerToken:        summarizeTimePerToken(normalizeTimesPerToken),
		dataflowTimePerToken:         summarizeTimePerToken(dataflowTimesPerToken),
		totalCommonTimePerToken:      summarizeTimePerToken(totalCommonTimesPerToken),
		controlFlowTimePerToken:      controlFlowTimePerToken.length > 0 ? summarizeTimePerToken(controlFlowTimePerToken) : undefined,
		callGraphTimePerToken:        callGraphTimePerToken.length > 0 ? summarizeTimePerToken(callGraphTimePerToken) : undefined,
		dataFrameShapeTimePerToken:   dataFrameShapeTimePerToken.length > 0 ? summarizeTimePerToken(dataFrameShapeTimePerToken) : undefined,
		retrieveTimePer100Lines:      summarizeMeasurement(retrieveTimesPer100Lines),
		normalizeTimePer100Lines:     summarizeMeasurement(normalizeTimesPer100Lines),
		dataflowTimePer100Lines:      summarizeMeasurement(dataflowTimesPer100Lines),
		totalCommonTimePer100Lines:   summarizeMeasurement(totalCommonTimesPer100Lines),
		controlFlowTimePer100Lines:   controlFlowTimesPer100Lines.length > 0 ? summarizeMeasurement(controlFlowTimesPer100Lines) : undefined,
		sliceTimePer100Lines:         summarizeSummarizedMeasurement(sliceTimesPer100Lines),
		reconstructTimePer100Lines:   summarizeSummarizedMeasurement(reconstructTimesPer100Lines),
		totalPerSliceTimePer100Lines: summarizeSummarizedMeasurement(totalPerSliceTimesPer100Lines),
		failedToRepParse,
		timesHitThreshold,
		reduction:                    summarizeSummarizedReductions(reductions),
		reductionNoFluff:             summarizeSummarizedReductions(reductionsNoFluff),
		input:                        {
			numberOfLines:                             summarizeMeasurement(inputs.map(i => i.numberOfLines)),
			numberOfNonEmptyLines:                     summarizeMeasurement(inputs.map(i => i.numberOfNonEmptyLines)),
			numberOfCharacters:                        summarizeMeasurement(inputs.map(i => i.numberOfCharacters)),
			numberOfCharactersNoComments:              summarizeMeasurement(inputs.map(i => i.numberOfCharactersNoComments)),
			numberOfNonWhitespaceCharacters:           summarizeMeasurement(inputs.map(i => i.numberOfNonWhitespaceCharacters)),
			numberOfNonWhitespaceCharactersNoComments: summarizeMeasurement(inputs.map(i => i.numberOfNonWhitespaceCharactersNoComments)),
			numberOfRTokens:                           summarizeMeasurement(inputs.map(i => i.numberOfRTokens)),
			numberOfRTokensNoComments:                 summarizeMeasurement(inputs.map(i => i.numberOfRTokensNoComments)),
			numberOfNormalizedTokens:                  summarizeMeasurement(inputs.map(i => i.numberOfNormalizedTokens)),
			numberOfNormalizedTokensNoComments:        summarizeMeasurement(inputs.map(i => i.numberOfNormalizedTokensNoComments))
		},
		dataflow: {
			numberOfNodes:               summarizeMeasurement(dataflows.map(d => d.numberOfNodes)),
			numberOfFunctionDefinitions: summarizeMeasurement(dataflows.map(d => d.numberOfFunctionDefinitions)),
			numberOfCalls:               summarizeMeasurement(dataflows.map(d => d.numberOfCalls)),
			numberOfEdges:               summarizeMeasurement(dataflows.map(d => d.numberOfEdges)),
			numberOfControlFlowEdges:    summarizeMeasurement(dataflows.map(d => d.numberOfControlFlowEdges ?? 0)),
			sizeOfObject:                summarizeMeasurement(dataflows.map(d => d.sizeOfObject)),
		},
		controlFlow: stats.some(s => s.controlFlow !== undefined) ? {
			numberOfVertices: summarizeMeasurement(stats.map(s => s.controlFlow?.numberOfVertices).filter(isNotUndefined)),
			numberOfEdges:    summarizeMeasurement(stats.map(s => s.controlFlow?.numberOfEdges).filter(isNotUndefined)),
			sizeOfObject:     summarizeMeasurement(stats.map(s => s.controlFlow?.sizeOfObject).filter(isNotUndefined))
		} : undefined,
		dataFrameShape: stats.some(s => s.dataFrameShape !== undefined) ? {
			numberOfDataFrameFiles:    arraySum(stats.map(s => s.dataFrameShape?.numberOfDataFrameFiles).filter(isNotUndefined)),
			numberOfNonDataFrameFiles: arraySum(stats.map(s => s.dataFrameShape?.numberOfNonDataFrameFiles).filter(isNotUndefined)),
			numberOfResultConstraints: summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfResultConstraints).filter(isNotUndefined)),
			numberOfResultingValues:   summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfResultingValues).filter(isNotUndefined)),
			numberOfResultingBottom:   summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfResultingBottom).filter(isNotUndefined)),
			numberOfResultingTop:      summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfResultingTop).filter(isNotUndefined)),
			numberOfEmptyNodes:        summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfEmptyNodes).filter(isNotUndefined)),
			numberOfOperationNodes:    summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfOperationNodes).filter(isNotUndefined)),
			numberOfValueNodes:        summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfValueNodes).filter(isNotUndefined)),
			sizeOfInfo:                summarizeMeasurement(stats.map(s => s.dataFrameShape?.sizeOfInfo).filter(isNotUndefined)),
			numberOfEntriesPerNode:    summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfEntriesPerNode).filter(isNotUndefined)),
			numberOfOperations:        summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfOperations).filter(isNotUndefined)),
			numberOfTotalConstraints:  summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfTotalConstraints).filter(isNotUndefined)),
			numberOfTotalExact:        summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfTotalExact).filter(isNotUndefined)),
			numberOfTotalValues:       summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfTotalValues).filter(isNotUndefined)),
			numberOfTotalBottom:       summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfTotalBottom).filter(isNotUndefined)),
			numberOfTotalTop:          summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfTotalTop).filter(isNotUndefined)),
			inferredColNames:          summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.inferredColNames).filter(isNotUndefined)),
			approxRangeColNames:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.approxRangeColNames).filter(isNotUndefined)),
			numberOfColNamesExact:     summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfColNamesExact).filter(isNotUndefined)),
			numberOfColNamesValues:    summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfColNamesValues).filter(isNotUndefined)),
			numberOfColNamesBottom:    summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfColNamesBottom).filter(isNotUndefined)),
			numberOfColNamesInfinite:  summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfColNamesInfinite).filter(isNotUndefined)),
			numberOfColNamesTop:       summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfColNamesTop).filter(isNotUndefined)),
			inferredColCount:          summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.inferredColCount).filter(isNotUndefined)),
			approxRangeColCount:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.approxRangeColCount).filter(isNotUndefined)),
			numberOfColCountExact:     summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfColCountExact).filter(isNotUndefined)),
			numberOfColCountValues:    summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfColCountValues).filter(isNotUndefined)),
			numberOfColCountBottom:    summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfColCountBottom).filter(isNotUndefined)),
			numberOfColCountInfinite:  summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfColCountInfinite).filter(isNotUndefined)),
			numberOfColCountTop:       summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfColCountTop).filter(isNotUndefined)),
			inferredRowCount:          summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.inferredRowCount).filter(isNotUndefined)),
			approxRangeRowCount:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.approxRangeRowCount).filter(isNotUndefined)),
			numberOfRowCountExact:     summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfRowCountExact).filter(isNotUndefined)),
			numberOfRowCountValues:    summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfRowCountValues).filter(isNotUndefined)),
			numberOfRowCountBottom:    summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfRowCountBottom).filter(isNotUndefined)),
			numberOfRowCountInfinite:  summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfRowCountInfinite).filter(isNotUndefined)),
			numberOfRowCountTop:       summarizeMeasurement(stats.map(s => s.dataFrameShape?.numberOfRowCountTop).filter(isNotUndefined)),
			perOperationNumber:        new Map(DataFrameOperationNames.map(n => [n, summarizeMeasurement(stats.map(s => s.dataFrameShape?.perOperationNumber.get(n) ?? 0))]))
		} : undefined
	};
}

/**
 * This big function summarizes multiple ultimate stats into one.
 */
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
		input:                        {
			numberOfLines:                             summarizeSummarizedMeasurement(stats.map(s => s.input.numberOfLines)),
			numberOfNonEmptyLines:                     summarizeSummarizedMeasurement(stats.map(s => s.input.numberOfNonEmptyLines)),
			numberOfCharacters:                        summarizeSummarizedMeasurement(stats.map(s => s.input.numberOfCharacters)),
			numberOfCharactersNoComments:              summarizeSummarizedMeasurement(stats.map(s => s.input.numberOfCharactersNoComments)),
			numberOfNonWhitespaceCharacters:           summarizeSummarizedMeasurement(stats.map(s => s.input.numberOfNonWhitespaceCharacters)),
			numberOfNonWhitespaceCharactersNoComments: summarizeSummarizedMeasurement(stats.map(s => s.input.numberOfNonWhitespaceCharactersNoComments)),
			numberOfRTokens:                           summarizeSummarizedMeasurement(stats.map(s => s.input.numberOfRTokens)),
			numberOfRTokensNoComments:                 summarizeSummarizedMeasurement(stats.map(s => s.input.numberOfRTokensNoComments)),
			numberOfNormalizedTokens:                  summarizeSummarizedMeasurement(stats.map(s => s.input.numberOfNormalizedTokens)),
			numberOfNormalizedTokensNoComments:        summarizeSummarizedMeasurement(stats.map(s => s.input.numberOfNormalizedTokensNoComments))
		},
		dataflow: {
			numberOfNodes:               summarizeSummarizedMeasurement(stats.map(s => s.dataflow.numberOfNodes)),
			numberOfFunctionDefinitions: summarizeSummarizedMeasurement(stats.map(s => s.dataflow.numberOfFunctionDefinitions)),
			numberOfCalls:               summarizeSummarizedMeasurement(stats.map(s => s.dataflow.numberOfCalls)),
			numberOfEdges:               summarizeSummarizedMeasurement(stats.map(s => s.dataflow.numberOfEdges)),
			numberOfControlFlowEdges:    summarizeSummarizedMeasurement(stats.map(s => s.dataflow.numberOfControlFlowEdges)),
			sizeOfObject:                summarizeSummarizedMeasurement(stats.map(s => s.dataflow.sizeOfObject)),
		},
		controlFlow: stats.some(s => s.controlFlow !== undefined) ? {
			numberOfVertices: summarizeSummarizedMeasurement(stats.map(s => s.controlFlow?.numberOfVertices).filter(isNotUndefined)),
			numberOfEdges:    summarizeSummarizedMeasurement(stats.map(s => s.controlFlow?.numberOfEdges).filter(isNotUndefined)),
			sizeOfObject:     summarizeSummarizedMeasurement(stats.map(s => s.controlFlow?.sizeOfObject).filter(isNotUndefined))
		} : undefined,
		dataFrameShape: stats.some(s => s.dataFrameShape !== undefined) ? {
			numberOfDataFrameFiles:    arraySum(stats.map(s => s.dataFrameShape?.numberOfDataFrameFiles).filter(isNotUndefined)),
			numberOfNonDataFrameFiles: arraySum(stats.map(s => s.dataFrameShape?.numberOfNonDataFrameFiles).filter(isNotUndefined)),
			numberOfResultConstraints: summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfResultConstraints).filter(isNotUndefined)),
			numberOfResultingValues:   summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfResultingValues).filter(isNotUndefined)),
			numberOfResultingBottom:   summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfResultingBottom).filter(isNotUndefined)),
			numberOfResultingTop:      summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfResultingTop).filter(isNotUndefined)),
			numberOfEmptyNodes:        summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfEmptyNodes).filter(isNotUndefined)),
			numberOfOperationNodes:    summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfOperationNodes).filter(isNotUndefined)),
			numberOfValueNodes:        summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfValueNodes).filter(isNotUndefined)),
			sizeOfInfo:                summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.sizeOfInfo).filter(isNotUndefined)),
			numberOfEntriesPerNode:    summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfEntriesPerNode).filter(isNotUndefined)),
			numberOfOperations:        summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfOperations).filter(isNotUndefined)),
			numberOfTotalConstraints:  summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfTotalConstraints).filter(isNotUndefined)),
			numberOfTotalExact:        summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfTotalExact).filter(isNotUndefined)),
			numberOfTotalValues:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfTotalValues).filter(isNotUndefined)),
			numberOfTotalBottom:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfTotalBottom).filter(isNotUndefined)),
			numberOfTotalTop:          summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfTotalTop).filter(isNotUndefined)),
			inferredColNames:          summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.inferredColNames).filter(isNotUndefined)),
			approxRangeColNames:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.approxRangeColNames).filter(isNotUndefined)),
			numberOfColNamesExact:     summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfColNamesExact).filter(isNotUndefined)),
			numberOfColNamesValues:    summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfColNamesValues).filter(isNotUndefined)),
			numberOfColNamesBottom:    summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfColNamesBottom).filter(isNotUndefined)),
			numberOfColNamesInfinite:  summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfColNamesInfinite).filter(isNotUndefined)),
			numberOfColNamesTop:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfColNamesTop).filter(isNotUndefined)),
			inferredColCount:          summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.inferredColCount).filter(isNotUndefined)),
			approxRangeColCount:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.approxRangeColCount).filter(isNotUndefined)),
			numberOfColCountExact:     summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfColCountExact).filter(isNotUndefined)),
			numberOfColCountValues:    summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfColCountValues).filter(isNotUndefined)),
			numberOfColCountBottom:    summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfColCountBottom).filter(isNotUndefined)),
			numberOfColCountInfinite:  summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfColCountInfinite).filter(isNotUndefined)),
			numberOfColCountTop:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfColCountTop).filter(isNotUndefined)),
			inferredRowCount:          summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.inferredRowCount).filter(isNotUndefined)),
			approxRangeRowCount:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.approxRangeRowCount).filter(isNotUndefined)),
			numberOfRowCountExact:     summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfRowCountExact).filter(isNotUndefined)),
			numberOfRowCountValues:    summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfRowCountValues).filter(isNotUndefined)),
			numberOfRowCountBottom:    summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfRowCountBottom).filter(isNotUndefined)),
			numberOfRowCountInfinite:  summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfRowCountInfinite).filter(isNotUndefined)),
			numberOfRowCountTop:       summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.numberOfRowCountTop).filter(isNotUndefined)),
			perOperationNumber:        new Map(DataFrameOperationNames.map(n => [n, summarizeSummarizedMeasurement(stats.map(s => s.dataFrameShape?.perOperationNumber.get(n)).filter(isNotUndefined))]))
		} : undefined
	};
}

/**
 * Processes the next summary line.
 */
export function processNextSummary(line: Buffer, allSummarized: SummarizedSlicerStats[]): void {
	let got = JSON.parse(line.toString()) as { summarize: SummarizedSlicerStats };
	got = {
		summarize: {
			...got.summarize,
			// restore maps
			memory: new Map(
				(got.summarize.memory as unknown as [CommonSlicerMeasurements, BenchmarkMemoryMeasurement][])
					.map(([k, v]) => [k, v])
			),
			commonMeasurements: new Map(
				(got.summarize.commonMeasurements as unknown as [CommonSlicerMeasurements, string][])
					.map(([k, v]) => {
						guard(v.endsWith('n'), 'Expected a bigint');
						return [k, BigInt(v.slice(0, -1))];
					})
			),
			additionalMeasurements: new Map(
				(got.summarize.additionalMeasurements as unknown as [AdditionalSlicerMeasurements, string][] ?? [])
					.map(([k, v]) => {
						guard(v.endsWith('n'), 'Expected a bigint');
						return [k, BigInt(v.slice(0, -1))];
					})
			),
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

/**
 * Processes the next ultimate summary line.
 */
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
