import type { SingleSlicingCriterion, SlicingCriteria } from '../../slicing'
import type { NodeId, RParseRequestFromFile, RParseRequestFromText } from '../../r-bridge'
import type { ReconstructionResult } from '../../slicing'

export const CommonSlicerMeasurements = ['initialize R session', 'inject home path', 'retrieve AST from R code', 'normalize R AST', 'produce dataflow information', 'run abstract interpretation', 'close R session', 'total'] as const
export type CommonSlicerMeasurements = typeof CommonSlicerMeasurements[number]

export const PerSliceMeasurements = ['static slicing', 'reconstruct code', 'total'] as const
export type PerSliceMeasurements = typeof PerSliceMeasurements[number]

export type ElapsedTime = bigint

export interface PerSliceStats {
	measurements:                Map<PerSliceMeasurements, ElapsedTime>
	slicingCriteria:             { criterion: SingleSlicingCriterion, id: NodeId }[]
	reconstructedCode:           ReconstructionResult
	numberOfDataflowNodesSliced: number
	timesHitThreshold:           number
}

export interface SlicerStatsInput<T = number> {
	numberOfLines:                   T
	numberOfCharacters:              T
	numberOfNonWhitespaceCharacters: T
	numberOfRTokens:                 T
	numberOfNormalizedTokens:        T
}


export interface SlicerStatsDataflow<T = number> {
	numberOfNodes:               T
	numberOfEdges:               T
	numberOfCalls:               T
	numberOfFunctionDefinitions: T
}

/**
 * The statistics that are collected by the {@link BenchmarkSlicer} and used for benchmarking.
 */
export interface SlicerStats {
	commonMeasurements:   Map<CommonSlicerMeasurements, ElapsedTime>
	perSliceMeasurements: Map<SlicingCriteria, PerSliceStats>
	request:              RParseRequestFromFile | RParseRequestFromText
	input:                SlicerStatsInput
	dataflow:             SlicerStatsDataflow
}
