/**
 * Provides a top-level slicer that can be used to slice code *and* retrieve stats.
 * @module
 */

import {
  decorateAst,
  DecoratedAst,
  getStoredTokenMap,
  NoInfo,
  normalize,
  retrieveXmlFromRCode,
  RExpressionList,
  RParseRequest,
  RShell
} from '../r-bridge'
import { Measurements } from './stopwatch'
import { guard } from '../util/assert'
import { DataflowInformation } from '../dataflow/internal/info'
import { produceDataFlowGraph } from '../dataflow'
import { convertAllSlicingCriteriaToIds, SlicingCriteria } from '../slicing/criteria'
import { staticSlicing } from '../slicing/static'
import { reconstructToCode } from '../slicing/reconstruct'


/*
export const SlicerMeasurements: MergeableRecord = {

}
*/

// TODO: total
export type CommonSlicerMeasurements = 'initialize R session'
  | 'inject home path'
  | 'ensure installation of xmlparsedata'
  | 'retrieve token map'
  | 'retrieve xml from R code'
  | 'normalize R ast'
  | 'decorate R ast'
  | 'produce dataflow information'

export type PerSliceMeasurements = 'decode slicing criterion'
  | 'static slicing'
  | 'reconstruct code'

interface PerSliceStats {
  measurements:    Measurements<PerSliceMeasurements>
  slicingCriteria: SlicingCriteria
  /* TODO: slicedOutput:    Set<NodeId>
  reconstructed:   string
   */
}

interface SlicerStats {
  commonMeasurements:   Measurements<CommonSlicerMeasurements>
  perSliceMeasurements: Map<SlicingCriteria, PerSliceStats>
  request:              RParseRequest
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


/**
 * A slicer that can be used to slice exactly one file (multiple times).
 * It holds its own {@link RShell} instance, maintains a cached dataflow and keeps measurements.
 *
 * Make sure to call {@link init} to initialize the slicer, before calling {@link slice}.
 */
export class Slicer {
  /** Measures all data that is recorded *once* per slicer (complete setup up to the dataflow graph creation) */
  private readonly commonMeasurements = new Measurements<CommonSlicerMeasurements>()
  private readonly perSliceMeasurements = new Map<SlicingCriteria, PerSliceStats>
  private readonly session: RShell
  private stats:            SlicerStats | undefined
  private tokenMap:         Record<string, string> | undefined
  private usedRequest:      RParseRequest | undefined
  private loadedXml:        string | undefined
  private normalizedAst:    RExpressionList | undefined
  private decoratedAst:     DecoratedAst | undefined
  private dataflow:         DataflowInformation | undefined

  constructor() {
    this.session = this.commonMeasurements.measure(
      'initialize R session',
      () => new RShell()
    )
    this.commonMeasurements.measure(
      'inject home path',
      () => this.session.tryToInjectHomeLibPath()
    )
  }

  /**
   * Initialize the slicer on the given request.
   * Can only be called once for each instance.
   */
  public async init(request: RParseRequest) {
    guard(this.stats === undefined, 'cannot initialize the slicer twice')

    this.usedRequest = request

    await this.commonMeasurements.measureAsync(
      'ensure installation of xmlparsedata',
      () => this.session.ensurePackageInstalled('xmlparsedata', true),
    )

    this.tokenMap = await this.commonMeasurements.measureAsync(
      'retrieve token map',
      () => getStoredTokenMap(this.session)
    )

    this.loadedXml = await this.commonMeasurements.measureAsync(
      'retrieve xml from R code',
      () => retrieveXmlFromRCode({
        ...request,
        attachSourceInformation: true,
        ensurePackageInstalled:  true
      }, this.session)
    )

    this.normalizedAst = await this.commonMeasurements.measureAsync(
      'normalize R ast',
      () => normalize(this.loadedXml as string, this.tokenMap as Record<string, string>)
    )

    this.decoratedAst = this.commonMeasurements.measure(
      'decorate R ast',
      () => decorateAst(this.normalizedAst as RExpressionList)
    )

    this.dataflow = this.commonMeasurements.measure(
      'produce dataflow information',
      () => produceDataFlowGraph(this.decoratedAst as DecoratedAst)
    )

    this.stats = {
      commonMeasurements:   this.commonMeasurements,
      perSliceMeasurements: this.perSliceMeasurements,
      request,
      input:                {
        // TODO: support file load
        numberOfLines:            -1,
        numberOfCharacters:       -1,
        numberOfRTokens:          -1,
        numberOfNormalizedTokens: -1
      },
      // TODO
      dataflow: {
        numberOfNodes:               -1,
        numberOfEdges:               -1,
        numberOfCalls:               -1,
        numberOfFunctionDefinitions: -1
      }
    }
  }

  public slice(slicingCriteria: SlicingCriteria) {
    guard(this.stats !== undefined, 'need to call init before slice!')
    guard(!this.perSliceMeasurements.has(slicingCriteria), 'do not slice the same criteria combination twice')

    const measurements = new Measurements<PerSliceMeasurements>()
    const stats: PerSliceStats = {
      measurements,
      slicingCriteria
    }
    this.perSliceMeasurements.set(slicingCriteria, stats)

    const mappedCriteria = measurements.measure(
      'decode slicing criterion',
      () => convertAllSlicingCriteriaToIds(slicingCriteria, this.decoratedAst as DecoratedAst)
    )

    const mappedIds = mappedCriteria.map(c => c.id)

    const slicedOutput = measurements.measure(
      'static slicing',
      () => staticSlicing(
        (this.dataflow as DataflowInformation).graph,
        (this.decoratedAst as DecoratedAst).idMap,
        mappedIds
      )
    )

    const reconstructedCode = measurements.measure(
      'reconstruct code',
      () => reconstructToCode<NoInfo>(this.decoratedAst as DecoratedAst, slicedOutput)
    )
    // TODO: end statistics
  }

  public getStats(): SlicerStats {
    guard(this.stats !== undefined, 'need to call init before getStats!')
    return this.stats
  }
}
