import type { SingleSlicingCriterion, SlicingCriteria } from '../../slicing/criterion/parse';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReconstructionResult } from '../../reconstruct/reconstruct';
import type { RParseRequestFromFile, RParseRequestFromText } from '../../r-bridge/retriever';
import type { TimePerToken } from '../summarizer/data';
import type { MergeableRecord } from '../../util/objects';
import type { DataFrameOperationName } from '../../abstract-interpretation/data-frame/semantics';

export const RequiredSlicerMeasurements = ['initialize R session', 'retrieve AST from R code', 'normalize R AST', 'produce dataflow information', 'close R session', 'total'] as const;
export const OptionalSlicerMeasurements = ['extract control flow graph', 'infer data frame shapes'] as const;
export const CommonSlicerMeasurements = [...RequiredSlicerMeasurements, ...OptionalSlicerMeasurements] as const;
export type CommonSlicerMeasurements = typeof CommonSlicerMeasurements[number]

export const PerSliceMeasurements = ['static slicing', 'reconstruct code', 'total'] as const;
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
	numberOfLines:                             T
	numberOfNonEmptyLines:                     T
	numberOfCharacters:                        T
	numberOfCharactersNoComments:              T
	numberOfNonWhitespaceCharacters:           T
	numberOfNonWhitespaceCharactersNoComments: T
	numberOfRTokens:                           T
	numberOfRTokensNoComments:                 T
	numberOfNormalizedTokens:                  T
	numberOfNormalizedTokensNoComments:        T
}


export interface SlicerStatsDataflow<T = number> {
	numberOfNodes:               T
	numberOfEdges:               T
	numberOfCalls:               T
	numberOfFunctionDefinitions: T
	/* size of object in bytes as measured by v8 serialization */
	sizeOfObject:                T
	storedVertexIndices:         T
	storedEnvIndices:            T
	overwrittenIndices:          T
}

export interface SlicerStatsDfShape<T = number> {
	numberOfDataFrameFiles:    T extends number ? 0 | 1 : number,
	numberOfNonDataFrameFiles: T extends number ? 0 | 1 : number,
	numberOfResultConstraints: T,
	numberOfResultingValues:   T,
	numberOfResultingTop:      T,
	numberOfResultingBottom:   T,
	numberOfEmptyNodes:        T,
	numberOfOperationNodes:    T,
	numberOfValueNodes:        T,
	sizeOfInfo:                T,
	perNodeStats:              Map<NodeId, PerNodeStatsDfShape<T>>
}

export interface PerNodeStatsDfShape<T = number> {
	numberOfEntries:      T,
	mappedOperations?:    DataFrameOperationName[]
	inferredColNames?:    T | 'bottom' | 'top',
	inferredColCount?:    T | 'bottom' | 'infinite' | 'top',
	inferredRowCount?:    T | 'bottom' | 'infinite' | 'top',
	/** difference between upper and lower bound of interval domain (to estimate approximation) */
	approxRangeColCount?: T,
	approxRangeRowCount?: T
}

/**
 * Please note, that these measurement can be negative as there is no guarantee that the memory usage will increase
 * due to, e.g., garbage collection.
*/
export interface BenchmarkMemoryMeasurement<T = number> extends MergeableRecord {
	/* used heap memory delta as reported by the node process in bytes */
	heap:     T
	/* resident set size delta as reported by the node process in bytes */
	rss:      T
	/* external memory delta as reported by the node process in bytes */
	external: T
	/* (array) buffer memory delta as reported by the node process in bytes */
	buffs:    T
}

/**
 * The statistics that are collected by the {@link BenchmarkSlicer} and used for benchmarking.
 */
export interface SlicerStats {
	commonMeasurements:          Map<CommonSlicerMeasurements, ElapsedTime>
	perSliceMeasurements:        Map<SlicingCriteria, PerSliceStats>
	memory:                      Map<CommonSlicerMeasurements, BenchmarkMemoryMeasurement>,
	request:                     RParseRequestFromFile | RParseRequestFromText
	input:                       SlicerStatsInput
	dataflow:                    SlicerStatsDataflow
	dataFrameShape?:             SlicerStatsDfShape
	retrieveTimePerToken:        TimePerToken<number>
	normalizeTimePerToken:       TimePerToken<number>
	dataflowTimePerToken:        TimePerToken<number>
	totalCommonTimePerToken:     TimePerToken<number>
	controlFlowTimePerToken?:    TimePerToken<number>
	dataFrameShapeTimePerToken?: TimePerToken<number>
}
