import {
	CommonSlicerMeasurements,
	PerSliceMeasurements,
	SlicerStats,
	SlicerStatsDataflow,
	SlicerStatsInput
} from '../../../benchmark'


export interface SummarizedMeasurement<T = number> {
	min:    T
	max:    T
	median: T
	/** total may be useless for some measurements, especially if they are weighted before (it is just the sum...)*/
	total:  T
	/** average */
	mean:   number
	/** standard deviation */
	std:    number
}

export function summarizedMeasurement2Csv(a: SummarizedMeasurement): string {
	return `${a.min},${a.max},${a.median},${a.mean},${a.std},${a.total}`
}

const summarizedKeys = ['min', 'max', 'median', 'mean', 'std', 'total']
export function summarizedMeasurement2CsvHeader(prefix?: string): string {
	return summarizedKeys.map(k => prefix ? `${prefix}-${k}` : k).join(',')
}

export interface SliceSizeCollection {
	lines:                   number[]
	characters:              number[]
	nonWhitespaceCharacters: number[]
	/** like library statements during reconstruction */
	autoSelected:            number[]
	dataflowNodes:           number[]
	tokens:                  number[]
	normalizedTokens:        number[]
}

/**
 * @see SlicerStats
 * @see summarizeSlicerStats
 */
export type SummarizedSlicerStats = {
	perSliceMeasurements: SummarizedPerSliceStats
} & Omit<SlicerStats, 'perSliceMeasurements'>

export interface Reduction<T = number> {
	numberOfLines:                   T
	numberOfLinesNoAutoSelection:    T
	numberOfCharacters:              T
	numberOfNonWhitespaceCharacters: T
	numberOfRTokens:                 T
	numberOfNormalizedTokens:        T
	numberOfDataflowNodes:           T
}

export interface SummarizedPerSliceStats {
	/** number of total slicing calls */
	numberOfSlices:     number
	/** statistics on the used slicing criteria (number of ids within criteria etc.) */
	sliceCriteriaSizes: SummarizedMeasurement
	measurements:       Map<PerSliceMeasurements, SummarizedMeasurement>
	reduction:          Reduction<SummarizedMeasurement>
	failedToRepParse:   number
	timesHitThreshold:  number
	sliceSize: {
		[K in keyof SliceSizeCollection]: SummarizedMeasurement
	}
}

export interface UltimateSlicerStats {
	totalRequests:        number
	totalSlices:          number
	commonMeasurements:   Map<CommonSlicerMeasurements, SummarizedMeasurement>
	perSliceMeasurements: Map<PerSliceMeasurements, SummarizedMeasurement>
	/** sum */
	failedToRepParse:     number
	/** sum */
	timesHitThreshold:    number
	reduction:            Reduction<SummarizedMeasurement>
	input:                SlicerStatsInput<SummarizedMeasurement>
	dataflow:             SlicerStatsDataflow<SummarizedMeasurement>
}
