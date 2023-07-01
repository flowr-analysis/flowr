/**
 * Provides a top-level slicer that can be used to slice code *and* retrieve stats.
 * @module
 */

import {
  collectAllIds,
  decorateAst,
  DecoratedAst,
  getStoredTokenMap,
  NoInfo,
  normalize,
  retrieveXmlFromRCode,
  RExpressionList,
  RParseRequestFromFile, RParseRequestFromText,
  RShell, ts2r
} from '../r-bridge'
import { IStoppableStopwatch, Measurements } from './stopwatch'
import { guard } from '../util/assert'
import { DataflowInformation } from '../dataflow/internal/info'
import { produceDataFlowGraph } from '../dataflow'
import { convertAllSlicingCriteriaToIds, SlicingCriteria } from '../slicing/criterion/parse'
import { staticSlicing } from '../slicing/static'
import { reconstructToCode } from '../slicing/reconstruct'
import { CommonSlicerMeasurements, ElapsedTime, PerSliceMeasurements, PerSliceStats, SlicerStats } from './stats/stats'
import fs from 'fs'



/**
 * A slicer that can be used to slice exactly one file (multiple times).
 * It holds its own {@link RShell} instance, maintains a cached dataflow and keeps measurements.
 *
 * Make sure to call {@link init} to initialize the slicer, before calling {@link slice}.
 * After slicing, call {@link finish} to close the R session and retrieve the stats.
 */
export class Slicer {
  /** Measures all data that is recorded *once* per slicer (complete setup up to the dataflow graph creation) */
  private readonly commonMeasurements = new Measurements<CommonSlicerMeasurements>()
  private readonly perSliceMeasurements = new Map<SlicingCriteria, PerSliceStats>
  private readonly session: RShell
  private stats:            SlicerStats | undefined
  private tokenMap:         Record<string, string> | undefined
  private usedRequest:      RParseRequestFromFile | RParseRequestFromText | undefined
  private loadedXml:        string | undefined
  private normalizedAst:    RExpressionList | undefined
  private decoratedAst:     DecoratedAst | undefined
  private dataflow:         DataflowInformation | undefined
  private totalStopwatch:   IStoppableStopwatch

  constructor() {
    this.totalStopwatch = this.commonMeasurements.start('total')
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
  public async init(request: RParseRequestFromFile | RParseRequestFromText) {
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
      'retrieve AST from R code',
      () => retrieveXmlFromRCode({
        ...request,
        attachSourceInformation: true,
        ensurePackageInstalled:  true
      }, this.session)
    )

    this.normalizedAst = await this.commonMeasurements.measureAsync(
      'normalize R AST',
      () => normalize(this.loadedXml as string, this.tokenMap as Record<string, string>)
    )

    this.decoratedAst = this.commonMeasurements.measure(
      'decorate R AST',
      () => decorateAst(this.normalizedAst as RExpressionList)
    )

    this.dataflow = this.commonMeasurements.measure(
      'produce dataflow information',
      () => produceDataFlowGraph(this.decoratedAst as DecoratedAst)
    )

    const loadedContent = request.request === 'text' ? request.content : fs.readFileSync(request.content, 'utf-8')
    // retrieve number of R tokens - flowr_parsed should still contain the last parsed code
    const numberOfRTokens = await this.session.sendCommandWithOutput(`cat(nrow(getParseData(flowr_parsed)),${ts2r(this.session.options.eol)})`)
    guard(numberOfRTokens.length === 1, 'expected exactly one line to obtain the number of R tokens')

    // collect dataflow graph size
    const nodes = [...this.dataflow.graph.nodes(true)]
    let numberOfEdges = 0
    let numberOfCalls = 0
    let numberOfDefinitions = 0

    for(const [n, info, graph] of nodes) {
      const nodeInGraph = graph.get(n, true)
      if(nodeInGraph === undefined) {
        continue
      }
      numberOfEdges += nodeInGraph[1].length
      if(info.tag === 'function-call') {
        numberOfCalls++
      } else if(info.tag === 'function-definition') {
        numberOfDefinitions++
      }
    }

    this.stats = {
      commonMeasurements:   new Map<CommonSlicerMeasurements, ElapsedTime>(),
      perSliceMeasurements: this.perSliceMeasurements,
      request,
      input:                {
        numberOfLines:            loadedContent.split('\n').length,
        numberOfCharacters:       loadedContent.length,
        numberOfRTokens:          Number(numberOfRTokens[0]),
        numberOfNormalizedTokens: [...collectAllIds(this.decoratedAst.decoratedAst)].length,
      },
      dataflow: {
        numberOfNodes:               [...this.dataflow.graph.nodes(true)].length,
        numberOfEdges:               numberOfEdges,
        numberOfCalls:               numberOfCalls,
        numberOfFunctionDefinitions: numberOfDefinitions
      }
    }
  }

  /**
   * Slice for the given {@link SlicingCriteria}.
   * @see SingleSlicingCriterion
   */
  public slice(...slicingCriteria: SlicingCriteria) {
    guard(this.stats !== undefined, 'need to call init before slice!')
    guard(!this.perSliceMeasurements.has(slicingCriteria), 'do not slice the same criteria combination twice')

    const measurements = new Measurements<PerSliceMeasurements>()
    const stats: PerSliceStats = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      measurements:      undefined as never,
      slicingCriteria:   [],
      reconstructedCode: ''
    }
    this.perSliceMeasurements.set(slicingCriteria, stats)

    const mappedCriteria = measurements.measure(
      'decode slicing criterion',
      () => convertAllSlicingCriteriaToIds(slicingCriteria, this.decoratedAst as DecoratedAst)
    )
    stats.slicingCriteria = mappedCriteria

    const mappedIds = mappedCriteria.map(c => c.id)

    const slicedOutput = measurements.measure(
      'static slicing',
      () => staticSlicing(
        (this.dataflow as DataflowInformation).graph,
        (this.decoratedAst as DecoratedAst).idMap,
        mappedIds
      )
    )

    stats.reconstructedCode = measurements.measure(
      'reconstruct code',
      () => reconstructToCode<NoInfo>(this.decoratedAst as DecoratedAst, slicedOutput)
    )

    stats.measurements = measurements.get()
    // TODO: end statistics
  }

  /**
   * Call {@link slice} for all slicing criteria that match the given filter.
   */
  public sliceForAll() {

  }


  /**
   * Retrieves the final stats and closes the shell session.
   */
  public finish(): SlicerStats {
    guard(this.stats !== undefined, 'need to call init before getStats!')
    this.commonMeasurements.measure(
      'close R session',
      () => this.session.close()
    )
    this.totalStopwatch.stop()
    this.stats.commonMeasurements = this.commonMeasurements.get()
    return this.stats
  }
}
