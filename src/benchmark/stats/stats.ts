import { SingleSlicingCriterion, SlicingCriteria } from '../../slicing/criterion/parse'
import { NodeId, RParseRequestFromFile, RParseRequestFromText } from '../../r-bridge'

export type CommonSlicerMeasurements = 'initialize R session'
  | 'inject home path'
  | 'ensure installation of xmlparsedata'
  | 'retrieve token map'
  | 'retrieve AST from R code'
  | 'normalize R AST'
  | 'decorate R AST'
  | 'produce dataflow information'
  | 'close R session'
  | 'total'

export type PerSliceMeasurements = 'decode slicing criterion'
  | 'static slicing'
  | 'reconstruct code'
  | 'total'

export type ElapsedTime = bigint

export interface PerSliceStats {
  measurements:                Map<PerSliceMeasurements, ElapsedTime>
  slicingCriteria:             { criterion: SingleSlicingCriterion, id: NodeId }[]
  reconstructedCode:           string
  numberOfDataflowNodesSliced: number
  /* TODO: slicedOutput:    Set<NodeId>
   */
}

/**
 * The statistics that are collected by the {@link Slicer} and used for benchmarking.
 */
export interface SlicerStats {
  commonMeasurements:   Map<CommonSlicerMeasurements, ElapsedTime>
  perSliceMeasurements: Map<SlicingCriteria, PerSliceStats>
  request:              RParseRequestFromFile | RParseRequestFromText
  input: {
    numberOfLines:            number
    numberOfCharacters:       number
    numberOfRTokens:          number
    numberOfNormalizedTokens: number
  }
  dataflow: {
    numberOfNodes:               number
    numberOfEdges:               number
    numberOfCalls:               number
    numberOfFunctionDefinitions: number
  }
}
