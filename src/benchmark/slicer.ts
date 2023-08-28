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
	normalize, retrieveNumberOfRTokensOfLastParse,
	retrieveXmlFromRCode,
	RParseRequestFromFile, RParseRequestFromText,
	RShell, TokenMap
} from '../r-bridge'
import { IStoppableStopwatch, Measurements } from './stopwatch'
import { guard } from '../util/assert'
import { DataflowInformation } from '../dataflow/internal/info'
import { produceDataFlowGraph } from '../dataflow'
import {
	convertAllSlicingCriteriaToIds,
	SlicingCriteria,
	collectAllSlicingCriteria,
	SlicingCriteriaFilter,
	reconstructToCode,
	staticSlicing, SliceResult, ReconstructionResult
} from '../slicing'
import {
	CommonSlicerMeasurements,
	ElapsedTime,
	withoutWhitespace,
	PerSliceMeasurements,
	PerSliceStats,
	SlicerStats
} from './stats'
import fs from 'fs'
import { log, LogLevel } from '../util/log'
import { MergeableRecord } from '../util/objects'

export const benchmarkLogger = log.getSubLogger({ name: "benchmark" })

/**
 * Returns the stats but also the result of all setup steps (parsing, normalization, and the dataflow analysis) during the slicing.
 * This is useful for debugging and visualizing the slicing process.
 */
export interface BenchmarkSlicerStats extends MergeableRecord {
	/** the measurements obtained during the benchmark */
	stats:        SlicerStats
	/** the used token map when translating what was parsed from R */
	tokenMap:     Record<string, string>
	/** the initial and unmodified AST produced by the R side/the 'parse' step */
	ast:          string
	/** the normalized AST produced by the 'normalization' step, including its parent decoration */
	decoratedAst: DecoratedAst
	/** the dataflow graph produced by the 'dataflow' step */
	dataflow:     DataflowInformation
}

/**
 * Additionally to {@link BenchmarkSlicerStats}, this contains the results of a *single* slice.
 * In other words, it holds the results of the slice and reconstruct steps.
 */
export interface BenchmarkSingleSliceStats extends MergeableRecord {
	/** the measurements obtained during the single slice */
	stats: PerSliceStats
	/** the result of the 'slice' step */
	slice: SliceResult
	/** the final code, as the result of the 'reconstruct' step */
	code:  ReconstructionResult
}

/**
 * A slicer that can be used to slice exactly one file (multiple times).
 * It holds its own {@link RShell} instance, maintains a cached dataflow and keeps measurements.
 *
 * Make sure to call {@link init} to initialize the slicer, before calling {@link slice}.
 * After slicing, call {@link finish} to close the R session and retrieve the stats.
 */
export class BenchmarkSlicer {
	/** Measures all data that is recorded *once* per slicer (complete setup up to the dataflow graph creation) */
	private readonly commonMeasurements = new Measurements<CommonSlicerMeasurements>()
	private readonly perSliceMeasurements = new Map<SlicingCriteria, PerSliceStats>
	private readonly session: RShell
	private stats:            SlicerStats | undefined
	private tokenMap:         Record<string, string> | undefined
	private loadedXml:        string | undefined
	private decoratedAst:     DecoratedAst | undefined
	private dataflow:         DataflowInformation | undefined
	private totalStopwatch:   IStoppableStopwatch
	private finished = false

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

		const normalizedAst = await this.commonMeasurements.measureAsync(
			'normalize R AST',
			() => normalize(this.loadedXml as string, this.tokenMap as Record<string, string>)
		)

		this.decoratedAst = this.commonMeasurements.measure(
			'decorate R AST',
			() => decorateAst(normalizedAst)
		)

		this.dataflow = this.commonMeasurements.measure(
			'produce dataflow information',
			() => produceDataFlowGraph(this.decoratedAst as DecoratedAst)
		)

		const loadedContent = request.request === 'text' ? request.content : fs.readFileSync(request.content, 'utf-8')
		// retrieve number of R tokens - flowr_parsed should still contain the last parsed code
		const numberOfRTokens = await retrieveNumberOfRTokensOfLastParse(this.session)

		// collect dataflow graph size
		const vertices = [...this.dataflow.graph.vertices(true)]
		let numberOfEdges = 0
		let numberOfCalls = 0
		let numberOfDefinitions = 0

		for(const [n, info] of vertices) {
			const outgoingEdges = this.dataflow.graph.outgoingEdges(n)
			numberOfEdges += outgoingEdges?.size ?? 0
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
				numberOfLines:                   loadedContent.split('\n').length,
				numberOfCharacters:              loadedContent.length,
				numberOfNonWhitespaceCharacters: withoutWhitespace(loadedContent).length,
				numberOfRTokens:                 numberOfRTokens,
				numberOfNormalizedTokens:        [...collectAllIds(this.decoratedAst.decoratedAst)].length,
			},
			dataflow: {
				numberOfNodes:               [...this.dataflow.graph.vertices(true)].length,
				numberOfEdges:               numberOfEdges,
				numberOfCalls:               numberOfCalls,
				numberOfFunctionDefinitions: numberOfDefinitions
			}
		}
	}

	/**
   * Slice for the given {@link SlicingCriteria}.
   * @see SingleSlicingCriterion
   *
   * @returns The per slice stats retrieved for this slicing criteria
   */
	public slice(...slicingCriteria: SlicingCriteria): BenchmarkSingleSliceStats {
		benchmarkLogger.trace(`try to slice for criteria ${JSON.stringify(slicingCriteria)}`)

		this.guardActive()
		guard(!this.perSliceMeasurements.has(slicingCriteria), 'do not slice the same criteria combination twice')

		const measurements = new Measurements<PerSliceMeasurements>()
		const stats: PerSliceStats = {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			measurements:                undefined as never,
			slicingCriteria:             [],
			numberOfDataflowNodesSliced: 0,
			timesHitThreshold:           0,
			reconstructedCode:           {
				code:         '',
				autoSelected: 0
			}
		}
		this.perSliceMeasurements.set(slicingCriteria, stats)

		const totalStopwatch = measurements.start('total')

		const mappedCriteria = measurements.measure(
			'decode slicing criterion',
			() => convertAllSlicingCriteriaToIds(slicingCriteria, this.decoratedAst as DecoratedAst)
		)
		stats.slicingCriteria = mappedCriteria
		if(benchmarkLogger.settings.minLevel >= LogLevel.info) {
			benchmarkLogger.info(`mapped slicing criteria: ${mappedCriteria.map(c => {
				const node = this.decoratedAst?.idMap.get(c.id)
				return `\n-   id: ${c.id}, location: ${JSON.stringify(node?.location)}, lexeme: ${JSON.stringify(node?.lexeme)}`
			}).join('')}`)
		}

		const mappedIds = mappedCriteria.map(c => c.id)

		const slicedOutput = measurements.measure(
			'static slicing',
			() => staticSlicing(
				(this.dataflow as DataflowInformation).graph,
				(this.decoratedAst as DecoratedAst).idMap,
				mappedIds
			)
		)
		// if it is not in the dataflow graph it was kept to be safe and should not count to the included nodes
		stats.numberOfDataflowNodesSliced = [...slicedOutput.result].filter(id => this.dataflow?.graph.hasNode(id, false)).length
		stats.timesHitThreshold = slicedOutput.timesHitThreshold

		stats.reconstructedCode = measurements.measure(
			'reconstruct code',
			() => reconstructToCode<NoInfo>(this.decoratedAst as DecoratedAst, slicedOutput.result)
		)
		totalStopwatch.stop()
		benchmarkLogger.debug(`Produced code for ${JSON.stringify(slicingCriteria)}: ${stats.reconstructedCode.code}`)

		stats.measurements = measurements.get()
		return {
			stats,
			slice: slicedOutput,
			code:  stats.reconstructedCode
		}
	}

	private guardActive() {
		guard(this.stats !== undefined && !this.finished, 'need to call init before, and can not do after finish!')
	}

	/**
   * Call {@link slice} for all slicing criteria that match the given filter.
   * See {@link collectAllSlicingCriteria} for details.
   * <p>
   * the `report` function will be called *before* each individual slice is performed.
   *
   * @returns The number of slices that were produced
   *
   * @see collectAllSlicingCriteria
   * @see SlicingCriteriaFilter
   */
	public sliceForAll(filter: SlicingCriteriaFilter, report: (current: number, total: number, allCriteria: SlicingCriteria[]) => void = () => { /* do nothing */ }): number {
		this.guardActive()
		let count = 0
		const allCriteria = [...collectAllSlicingCriteria((this.decoratedAst as DecoratedAst).decoratedAst, filter)]
		for(const slicingCriteria of allCriteria) {
			report(count, allCriteria.length, allCriteria)
			this.slice(...slicingCriteria)
			count++
		}
		return count
	}

	/**
   * Retrieves the final stats and closes the shell session.
   * Can be called multiple times to retrieve the stored stats, but will only close the session once (the first time).
   */
	public finish(): BenchmarkSlicerStats {
		guard(this.stats !== undefined, 'need to call init before finish')

		if(!this.finished) {
			this.commonMeasurements.measure(
				'close R session',
				() => this.session.close()
			)
			this.totalStopwatch.stop()
			this.finished = true
		}

		this.stats.commonMeasurements = this.commonMeasurements.get()
		return {
			stats:        this.stats,
			ast:          this.loadedXml as string,
			dataflow:     this.dataflow as DataflowInformation,
			decoratedAst: this.decoratedAst as DecoratedAst,
			tokenMap:     this.tokenMap as TokenMap,
		}
	}

	/**
   * Only call in case of an error - if the session must be closed and the benchmark itself is to be considered failed/dead.
   */
	public ensureSessionClosed(): void {
		this.session.close()
	}
}
