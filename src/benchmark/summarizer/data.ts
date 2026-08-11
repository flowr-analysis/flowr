import type { DataFrameOperationName } from '../../abstract-interpretation/data-frame/semantics';
import type { SummarizedMeasurement } from '../../util/summarizer';
import type {
	AdditionalSlicerMeasurements,
	CommonSlicerMeasurements,
	PerSliceMeasurements,
	SlicerStats,
	SlicerStatsDfShape,
	FlowrFeatureCounts,
	SlicerStatsControlFlow,
	SlicerStatsDataflow,
	SlicerStatsInput
} from '../stats/stats';


export interface SliceSizeCollection {
	lines:                             number[]
	nonEmptyLines:                     number[]
	characters:                        number[]
	charactersNoComments:              number[]
	nonWhitespaceCharacters:           number[]
	nonWhitespaceCharactersNoComments: number[]
	/** like library statements during reconstruction */
	linesWithAutoSelected:             number[]
	dataflowNodes:                     number[]
	tokens:                            number[]
	tokensNoComments:                  number[]
	normalizedTokens:                  number[]
	normalizedTokensNoComments:        number[]
}

/**
 * @see SlicerStats
 * @see summarizeSlicerStats
 */
export type SummarizedSlicerStats = {
	perSliceMeasurements: SummarizedPerSliceStats,
	dataFrameShape?:      SummarizedDfShapeStats
} & Omit<SlicerStats, 'perSliceMeasurements' | 'dataFrameShape'>;

export interface Reduction<T = number> {
	numberOfLines:                   T
	numberOfLinesNoAutoSelection:    T
	numberOfCharacters:              T
	numberOfNonWhitespaceCharacters: T
	numberOfRTokens:                 T
	numberOfNormalizedTokens:        T
	numberOfDataflowNodes:           T
}

export interface TimePerToken<T = SummarizedMeasurement> {
	raw:        T,
	normalized: T
}

export interface SummarizedPerSliceStats {
	/** number of total slicing calls */
	numberOfSlices:               number
	/** statistics on the used slicing criteria (number of ids within criteria etc.) */
	sliceCriteriaSizes:           SummarizedMeasurement
	measurements:                 Map<PerSliceMeasurements, SummarizedMeasurement>
	sliceTimePerToken:            TimePerToken
	reconstructTimePerToken:      TimePerToken
	totalPerSliceTimePerToken:    TimePerToken
	/** the per 100 lines of input pendant to {@link sliceTimePerToken} */
	sliceTimePer100Lines:         SummarizedMeasurement
	reconstructTimePer100Lines:   SummarizedMeasurement
	totalPerSliceTimePer100Lines: SummarizedMeasurement
	reduction:                    Reduction<SummarizedMeasurement>
	/** reduction, but without taking into account comments and empty lines */
	reductionNoFluff:             Reduction<SummarizedMeasurement>
	failedToRepParse:             number
	timesHitThreshold:            number
	sliceSize: {
		[K in keyof SliceSizeCollection]: SummarizedMeasurement
	}
}

export interface UltimateSlicerStats {
	totalRequests:                number
	totalSlices:                  number
	commonMeasurements:           Map<CommonSlicerMeasurements, SummarizedMeasurement>
	perSliceMeasurements:         Map<PerSliceMeasurements, SummarizedMeasurement>
	/** measured after all {@link commonMeasurements}, see {@link AdditionalSlicerMeasurements} */
	additionalMeasurements:       Map<AdditionalSlicerMeasurements, SummarizedMeasurement>
	retrieveTimePerToken:         TimePerToken
	normalizeTimePerToken:        TimePerToken
	dataflowTimePerToken:         TimePerToken
	totalCommonTimePerToken:      TimePerToken
	controlFlowTimePerToken?:     TimePerToken
	callGraphTimePerToken?:       TimePerToken
	dataFrameShapeTimePerToken?:  TimePerToken
	sliceTimePerToken:            TimePerToken
	reconstructTimePerToken:      TimePerToken
	totalPerSliceTimePerToken:    TimePerToken
	/** the per 100 lines of input pendant to {@link retrieveTimePerToken} */
	retrieveTimePer100Lines:      SummarizedMeasurement
	normalizeTimePer100Lines:     SummarizedMeasurement
	dataflowTimePer100Lines:      SummarizedMeasurement
	totalCommonTimePer100Lines:   SummarizedMeasurement
	controlFlowTimePer100Lines?:  SummarizedMeasurement
	sliceTimePer100Lines:         SummarizedMeasurement
	reconstructTimePer100Lines:   SummarizedMeasurement
	totalPerSliceTimePer100Lines: SummarizedMeasurement
	/** sum */
	failedToRepParse:             number
	/** sum */
	timesHitThreshold:            number
	reduction:                    Reduction<SummarizedMeasurement>
	/** reduction, but without taking into account comments and empty lines */
	reductionNoFluff:             Reduction<SummarizedMeasurement>
	input:                        SlicerStatsInput<SummarizedMeasurement>
	dataflow:                     SlicerStatsDataflow<SummarizedMeasurement>
	features?:                    FlowrFeatureCounts
	controlFlow?:                 SlicerStatsControlFlow<SummarizedMeasurement>
	dataFrameShape?:              SummarizedDfShapeStats<SummarizedMeasurement>
}

export interface SummarizedDfShapeStats<T = number> extends Omit<SlicerStatsDfShape<T>, 'perNodeStats'> {
	numberOfEntriesPerNode:   SummarizedMeasurement,
	numberOfOperations:       T,
	numberOfTotalConstraints: T,
	numberOfTotalExact:       T,
	numberOfTotalValues:      T,
	numberOfTotalBottom:      T,
	numberOfTotalTop:         T,
	inferredColNames:         SummarizedMeasurement,
	approxRangeColNames:      SummarizedMeasurement,
	numberOfColNamesExact:    T,
	numberOfColNamesValues:   T,
	numberOfColNamesBottom:   T,
	numberOfColNamesInfinite: T,
	numberOfColNamesTop:      T,
	inferredColCount:         SummarizedMeasurement,
	approxRangeColCount:      SummarizedMeasurement,
	numberOfColCountExact:    T,
	numberOfColCountValues:   T,
	numberOfColCountBottom:   T,
	numberOfColCountInfinite: T,
	numberOfColCountTop:      T,
	inferredRowCount:         SummarizedMeasurement,
	approxRangeRowCount:      SummarizedMeasurement,
	numberOfRowCountExact:    T,
	numberOfRowCountValues:   T,
	numberOfRowCountBottom:   T,
	numberOfRowCountInfinite: T,
	numberOfRowCountTop:      T,
	perOperationNumber:       Map<DataFrameOperationName, T>
}
