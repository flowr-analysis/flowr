/**
 * Provides a top-level slicer that can be used to slice code *and* retrieve stats.
 * @module
 */

import { type IStoppableStopwatch, Measurements } from './stopwatch';
import seedrandom from 'seedrandom';
import { log, LogLevel } from '../util/log';
import type { MergeableRecord } from '../util/objects';
import type { DataflowInformation } from '../dataflow/info';
import type { SliceResult } from '../slicing/static/slicer-types';
import type { InlineFull, ReconstructionResult } from '../reconstruct/reconstruct';
import type { PipelineExecutor } from '../core/pipeline-executor';
import { guard } from '../util/assert';
import { withoutWhitespace } from '../util/text/strings';
import { countAstComments } from './stats/count-comments';
import type {
	AdditionalSlicerMeasurements,
	BenchmarkMemoryMeasurement,
	CommonSlicerMeasurements,
	ElapsedTime,
	PerNodeStatsDfShape,
	PerSliceMeasurements,
	PerSliceStats,
	SlicerStats,
	SlicerStatsDfShape
} from './stats/stats';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { SlicingCriteria } from '../slicing/criterion/parse';
import {
	createSlicePipeline,
	type DEFAULT_SLICING_PIPELINE,
	type TREE_SITTER_SLICING_PIPELINE
} from '../core/steps/pipeline/default-pipelines';
import {
	retrieveNumberOfRTokensOfLastParse,
	type RParseRequestFromFile,
	type RParseRequestFromText
} from '../r-bridge/retriever';
import type { PipelineStepNames, PipelineStepOutputWithName } from '../core/steps/pipeline/pipeline';
import { collectAllSlicingCriteria, type SlicingCriteriaFilter } from '../slicing/criterion/collect-all';
import { getSizeOfCfGraph, getSizeOfDfGraph, safeSizeOf } from './stats/size-of';
import type { AutoSelectPredicate } from '../reconstruct/auto-select/auto-select-defaults';
import type { KnownParser, KnownParserName, KnownParserType } from '../r-bridge/parser';
import type { SyntaxNode, Tree } from 'web-tree-sitter';
import { RShell } from '../r-bridge/shell';
import { TreeSitterType } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-types';
import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FunctionCallVertex, FunctionDefinitionVertex } from '../dataflow/graph/vertex';
import { ControlFlowEdgeTypes, DfEdge } from '../dataflow/graph/edge';
import { NoEdges } from '../dataflow/graph/graph';
import { equidistantSampling, arraySum } from '../util/collections/arrays';
import { FlowrConfig } from '../config';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import { extractCfg } from '../control-flow/control-flow-graph';
import { DataFrameShapeInferenceVisitor } from '../abstract-interpretation/data-frame/shape-inference';
import type { PosIntervalDomain } from '../abstract-interpretation/domains/positive-interval-domain';
import { SetRangeDomain } from '../abstract-interpretation/domains/set-range-domain';
import fs from 'fs';
import { type FlowrAnalyzerContext, contextFromInput } from '../project/context/flowr-analyzer-context';
import { RProject } from '../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { CallGraph } from '../dataflow/graph/call-graph';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { runCalibration } from './calibration';

/**
 * The logger to be used for benchmarking as a global object.
 */
export const benchmarkLogger = log.getSubLogger({ name: 'benchmark' });

/**
 * Returns the stats but also the result of all setup steps (parsing, normalization, and the dataflow analysis) during the slicing.
 * This is useful for debugging and visualizing the slicing process.
 */
export interface BenchmarkSlicerStats extends MergeableRecord {
	/** the measurements obtained during the benchmark */
	stats:     SlicerStats
	/** the initial and unmodified AST produced by the R side/the 'parse' step */
	parse:     string
	/** the normalized AST produced by the 'normalization' step, including its parent decoration */
	normalize: NormalizedAst
	/** the dataflow graph produced by the 'dataflow' step */
	dataflow:  DataflowInformation
}

/**
 * Additionally to {@link BenchmarkSlicerStats}, this contains the results of a *single* slice.
 * In other words, it holds the results of the `slice` and `reconstruct` steps.
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
 * The type of sampling strategy to use when slicing all possible variables.
 *
 * - `'random'`: Randomly select the given number of slicing criteria.
 * - `'equidistant'`: Select the given number of slicing criteria in an equidistant manner.
 */
export type SamplingStrategy = 'random' | 'equidistant';

/**
 * A slicer that can be used to slice exactly one file (multiple times).
 * It holds its own {@link RShell} instance, maintains a cached dataflow, and keeps measurements.
 *
 * Make sure to call {@link init} to initialize the slicer, before calling {@link slice}.
 * After slicing, call {@link finish} to close the R session and retrieve the stats.
 * @note Under the hood, the benchmark slicer maintains a {@link PipelineExecutor} using the {@link DEFAULT_SLICING_PIPELINE} or the {@link TREE_SITTER_SLICING_PIPELINE}.
 */
type SupportedPipelines = typeof DEFAULT_SLICING_PIPELINE | typeof TREE_SITTER_SLICING_PIPELINE;
export class BenchmarkSlicer {
	/** Measures all data recorded *once* per slicer (complete setup up to the dataflow graph creation) */
	private readonly commonMeasurements   = new Measurements<CommonSlicerMeasurements>();
	private readonly perSliceMeasurements = new Map<SlicingCriteria, PerSliceStats>();
	private readonly deltas               = new Map<CommonSlicerMeasurements, BenchmarkMemoryMeasurement>();
	/** filled by {@link measureAdditionalPhases}, only holds the phases that did not fail */
	private readonly additionalMeasurements = new Map<AdditionalSlicerMeasurements, ElapsedTime>();
	private readonly parserName: KnownParserName;
	private context:             FlowrAnalyzerContext | undefined;
	private config:              FlowrConfig | undefined;
	private request:             RParseRequestFromFile | RParseRequestFromText | undefined;
	private stats:               SlicerStats | undefined;
	private loadedXml:           string | KnownParserType[] | undefined;
	private dataflow:            DataflowInformation | undefined;
	private normalizedAst:       NormalizedAst | undefined;
	private controlFlow:         ControlFlowInformation | undefined;
	private callGraph:           CallGraph | undefined;
	private totalStopwatch:      IStoppableStopwatch;
	private finished = false;
	// Yes, this is unclean, but we know that we assign the executor during the initialization and this saves us from having to check for nullability every time
	private executor:            PipelineExecutor<SupportedPipelines> = null as unknown as PipelineExecutor<SupportedPipelines>;
	private parser:              KnownParser  = null as unknown as KnownParser;

	constructor(parserName: KnownParserName) {
		this.totalStopwatch = this.commonMeasurements.start('total');
		this.parserName = parserName;
	}

	/**
	 * Initialize the slicer on the given request.
	 * Can only be called once for each instance.
	 */
	public async init(request: RParseRequestFromFile | RParseRequestFromText, config: FlowrConfig,
		autoSelectIf?: AutoSelectPredicate, threshold?: number, inlineSources?: boolean, includeCallees?: boolean,
		inlineFull?: InlineFull) {
		guard(this.stats === undefined, 'cannot initialize the slicer twice');

		// we know these are in sync so we just cast to one of them
		this.parser = await this.commonMeasurements.measure(
			'initialize R session', async() => {
				if(this.parserName === 'r-shell') {
					return new RShell(FlowrConfig.getForEngine(config, 'r-shell'));
				} else {
					await TreeSitterExecutor.initTreeSitter(FlowrConfig.getForEngine(config, 'tree-sitter'));
					return new TreeSitterExecutor();
				}
			}
		);
		this.config = config;
		this.request = request;
		this.context = contextFromInput({ ...request }, config);
		this.executor = createSlicePipeline(this.parser, {
			context:   this.context,
			criterion: [],
			autoSelectIf,
			threshold,
			inlineSources,
			includeCallees,
			inlineFull,
		});

		this.loadedXml = (await this.measureCommonStep('parse', 'retrieve AST from R code')).files.map(p => p.parsed);
		this.normalizedAst = await this.measureCommonStep('normalize', 'normalize R AST');
		this.dataflow = await this.measureCommonStep('dataflow', 'produce dataflow information');

		this.executor.switchToRequestStage();

		await this.calculateStatsAfterInit(request);
	}

	private async calculateStatsAfterInit(request: RParseRequestFromFile | RParseRequestFromText) {
		const loadedContent = request.request === 'text' ? request.content : fs.readFileSync(request.content, 'utf-8');
		let numberOfRTokens: number;
		let numberOfRTokensNoComments: number;
		if(this.parser.name === 'r-shell') {
			// retrieve number of R tokens - flowr_parsed should still contain the last parsed code
			numberOfRTokens = await retrieveNumberOfRTokensOfLastParse(this.parser as RShell);
			numberOfRTokensNoComments = await retrieveNumberOfRTokensOfLastParse(this.parser as RShell, true);
		} else {
			const countChildren = function(node: SyntaxNode, ignoreComments = false): number {
				let ret = node.type === TreeSitterType.Comment && ignoreComments ? 0 : 1;
				for(const child of node.children) {
					ret += countChildren(child, ignoreComments);
				}
				return ret;
			};
			const root = (this.loadedXml as Tree[]).map(t => t.rootNode);
			numberOfRTokens = arraySum(root.map(r => countChildren(r)));
			numberOfRTokensNoComments = arraySum(root.map(r => countChildren(r, true)));
		}

		guard(this.normalizedAst !== undefined, 'normalizedAst should be defined after initialization');
		guard(this.dataflow !== undefined, 'dataflow should be defined after initialization');

		// collect dataflow graph size
		const vertices = this.dataflow.graph.vertices(true);
		let numberOfEdges = 0;
		let numberOfControlFlowEdges = 0;
		let numberOfCalls = 0;
		let numberOfDefinitions = 0;

		for(const [n, info] of vertices) {
			const outgoingEdges = this.dataflow.graph.outgoingEdges(n);
			for(const [, edge] of outgoingEdges ?? NoEdges) {
				/* the control flow lives in the very same graph, so it is counted on its own to stay comparable */
				if(DfEdge.includesType(edge, ControlFlowEdgeTypes)) {
					numberOfControlFlowEdges++;
				}
				if(!DfEdge.isOnlyControlFlow(edge)) {
					numberOfEdges++;
				}
			}
			if(FunctionCallVertex.is(info)) {
				numberOfCalls++;
			} else if(FunctionDefinitionVertex.is(info)) {
				numberOfDefinitions++;
			}
		}

		const { nodes, nodesNoComments, commentChars, commentCharsNoWhitespace } = countAstComments(this.normalizedAst.ast);

		const split = loadedContent.split('\n');
		const nonWhitespace = withoutWhitespace(loadedContent).length;
		this.stats = {
			perSliceMeasurements:   this.perSliceMeasurements,
			additionalMeasurements: this.additionalMeasurements,
			memory:                 this.deltas,
			request,
			input:                  {
				numberOfLines:                             split.length,
				numberOfNonEmptyLines:                     split.filter(l => l.trim().length > 0).length,
				numberOfCharacters:                        loadedContent.length,
				numberOfCharactersNoComments:              loadedContent.length - commentChars,
				numberOfNonWhitespaceCharacters:           nonWhitespace,
				numberOfNonWhitespaceCharactersNoComments: nonWhitespace - commentCharsNoWhitespace,
				numberOfRTokens:                           numberOfRTokens,
				numberOfRTokensNoComments:                 numberOfRTokensNoComments,
				numberOfNormalizedTokens:                  nodes,
				numberOfNormalizedTokensNoComments:        nodesNoComments
			},
			dataflow: {
				numberOfNodes:               this.dataflow.graph.vertices(true).toArray().length,
				numberOfEdges:               numberOfEdges,
				numberOfControlFlowEdges:    numberOfControlFlowEdges,
				numberOfCalls:               numberOfCalls,
				numberOfFunctionDefinitions: numberOfDefinitions,
				sizeOfObject:                getSizeOfDfGraph(this.dataflow.graph),
			},

			// these are all properly initialized in finish()
			commonMeasurements:         new Map<CommonSlicerMeasurements, ElapsedTime>(),
			retrieveTimePerToken:       { raw: 0, normalized: 0 },
			normalizeTimePerToken:      { raw: 0, normalized: 0 },
			dataflowTimePerToken:       { raw: 0, normalized: 0 },
			totalCommonTimePerToken:    { raw: 0, normalized: 0 },
			retrieveTimePer100Lines:    0,
			normalizeTimePer100Lines:   0,
			dataflowTimePer100Lines:    0,
			totalCommonTimePer100Lines: 0
		};
	}

	/**
	 * Slice for the given {@link SlicingCriteria}.
	 * @see SingleSlicingCriterion
	 * @returns The per slice stats retrieved for this slicing criteria
	 */
	public async slice(...slicingCriteria: SlicingCriteria): Promise<BenchmarkSingleSliceStats> {
		benchmarkLogger.trace(`try to slice for criteria ${JSON.stringify(slicingCriteria)}`);

		this.guardActive();
		guard(!this.perSliceMeasurements.has(slicingCriteria), 'do not slice the same criteria combination twice');

		const measurements = new Measurements<PerSliceMeasurements>();
		const stats: PerSliceStats = {
			measurements:                undefined as never,
			slicingCriteria:             [],
			numberOfDataflowNodesSliced: 0,
			timesHitThreshold:           0,
			reconstructedCode:           {
				code:                  '',
				linesWithAutoSelected: 0
			}
		};
		this.perSliceMeasurements.set(slicingCriteria, stats);

		this.executor.updateRequest({ criterion: slicingCriteria });

		const totalStopwatch = measurements.start('total');


		const slicedOutput = await this.measureSliceStep('slice', measurements, 'static slicing');
		const decodedCriteria = SlicingCriteria.decodeAll(slicingCriteria, (this.normalizedAst as NormalizedAst).idMap);
		stats.slicingCriteria = Array.from(decodedCriteria);

		stats.reconstructedCode = await this.measureSliceStep('reconstruct', measurements, 'reconstruct code');

		totalStopwatch.stop();

		benchmarkLogger.debug(`Produced code for ${JSON.stringify(slicingCriteria)}: ${stats.reconstructedCode.code as string}`);
		const results = this.executor.getResults(false);

		if(benchmarkLogger.settings.minLevel >= LogLevel.Info) {
			benchmarkLogger.info(`mapped slicing criteria: ${slicedOutput.slicedFor.map(id => {
				const node = results.normalize.idMap.get(id);
				return `\n-   id: ${id}, location: ${JSON.stringify(node?.location)}, lexeme: ${JSON.stringify(node?.lexeme)}`;
			}).join('')}`);
		}

		// if it is not in the dataflow graph it was kept to be safe and should not count to the included nodes
		stats.numberOfDataflowNodesSliced = Array.from(slicedOutput.result).filter(id => results.dataflow.graph.hasVertex(id, false)).length;
		stats.timesHitThreshold = slicedOutput.timesHitThreshold;

		stats.measurements = measurements.get();
		return {
			stats,
			slice: slicedOutput,
			code:  stats.reconstructedCode
		};
	}

	/**
	 * Project the control flow graph out of the dataflow graph that carries it.
	 *
	 * There is no separate control flow analysis any more, so what the step measures is the cost of holding
	 * the control flow as its own structure; walking it on the dataflow graph costs nothing on top of the
	 * dataflow analysis itself.
	 */
	public extractCFG(): void {
		benchmarkLogger.trace('try to extract the control flow graph');

		this.guardActive();
		guard(this.dataflow !== undefined, 'dataflow should be defined for control flow extraction');

		const dataflow = this.dataflow;

		this.controlFlow = this.measureSimpleStep('extract control flow graph', () => {
			const cfg = extractCfg(dataflow);
			/* the graph is a view until something asks for all of it, so this is what there is to measure */
			cfg.graph.vertices(true);
			cfg.graph.edges();
			return cfg;
		});
		if(this.stats) {
			this.stats.controlFlow = {
				numberOfVertices: this.controlFlow.graph.vertices(true).size,
				numberOfEdges:    [...this.controlFlow.graph.edges().values()].reduce((a, e) => a + e.size, 0),
				sizeOfObject:     getSizeOfCfGraph(this.controlFlow.graph)
			};
		}
	}

	public extractCG(): void {
		benchmarkLogger.trace('try to extract the call graph');
		this.guardActive();
		const g = this.dataflow?.graph;
		guard(g !== undefined, 'dataflow should be defined for call graph extraction');

		this.callGraph = this.measureSimpleStep('extract call graph', () => CallGraph.compute(g));
	}

	/**
	 * Infer the shape of data frames using abstract interpretation with {@link inferDataFrameShapes}
	 * @returns The statistics of the data frame shape inference
	 */
	public inferDataFrameShapes(): SlicerStatsDfShape {
		benchmarkLogger.trace('try to infer shapes for data frames');

		guard(this.stats !== undefined && !this.finished, 'need to call init before, and can not do after finish!');
		guard(this.normalizedAst !== undefined, 'normalizedAst should be defined for data frame shape inference');
		guard(this.dataflow !== undefined, 'dataflow should be defined for data frame shape inference');
		guard(this.controlFlow !== undefined, 'controlFlow should be defined for data frame shape inference');
		guard(this.context !== undefined, 'context should be defined for data frame shape inference');

		const ast = this.normalizedAst;
		const dfg = this.dataflow.graph;
		const cfinfo = this.controlFlow;

		const stats: SlicerStatsDfShape = {
			numberOfDataFrameFiles:    0,
			numberOfNonDataFrameFiles: 0,
			numberOfResultConstraints: 0,
			numberOfResultingValues:   0,
			numberOfResultingBottom:   0,
			numberOfResultingTop:      0,
			numberOfEmptyNodes:        0,
			numberOfOperationNodes:    0,
			numberOfValueNodes:        0,
			sizeOfInfo:                0,
			perNodeStats:              new Map()
		};

		const inference = new DataFrameShapeInferenceVisitor({ controlFlow: cfinfo, dfg, normalizedAst: ast, ctx: this.context });
		this.measureSimpleStep('infer data frame shapes', () => inference.start());
		const result = inference.getEndState();

		stats.numberOfResultConstraints = result.isValue() ? result.value.size : 0;
		stats.sizeOfInfo = safeSizeOf(inference.getAbstractTrace().entries().toArray());

		for(const value of result.isValue() ? result.value.values() : []) {
			if(value.isTop()) {
				stats.numberOfResultingTop++;
			} else if(value.isBottom()) {
				stats.numberOfResultingBottom++;
			} else {
				stats.numberOfResultingValues++;
			}
		}

		RProject.visitAst(this.normalizedAst.ast, node => {
			const operations = inference.getAbstractOperations(node.info.id);
			const value = inference.getAbstractValue(node.info.id);

			// Only store per-node information for nodes representing expressions or nodes with abstract values
			if(operations === undefined && value === undefined) {
				stats.numberOfEmptyNodes++;
				return;
			}
			const state = inference.getAbstractState(node.info.id);

			const nodeStats: PerNodeStatsDfShape = {
				numberOfEntries: state?.isValue() ? state.value.size : 0
			};

			if(operations !== undefined) {
				nodeStats.mappedOperations = operations.map(op => op.operation);
				stats.numberOfOperationNodes++;

				if(value !== undefined) {
					nodeStats.inferredColNames = this.getInferredNumber(value.colnames);
					nodeStats.inferredColCount = this.getInferredNumber(value.cols);
					nodeStats.inferredRowCount = this.getInferredNumber(value.rows);
					nodeStats.approxRangeColNames = this.getInferredRange(value.colnames);
					nodeStats.approxRangeColCount = this.getInferredRange(value.cols);
					nodeStats.approxRangeRowCount = this.getInferredRange(value.rows);
				}
			}
			if(value !== undefined) {
				stats.numberOfValueNodes++;
			}
			stats.perNodeStats.set(node.info.id, nodeStats);
		});
		if(stats.numberOfOperationNodes > 0) {
			stats.numberOfDataFrameFiles = 1;
		} else {
			stats.numberOfNonDataFrameFiles = 1;
		}
		this.stats.dataFrameShape = stats;

		return stats;
	}

	/**
	 * Measure the phases that are not part of the slicing itself: the dependencies query, the linter,
	 * and the synthetic {@link runCalibration | calibration} workload, the only one that reports its own time.
	 *
	 * These run *after* all other steps and are excluded from the {@link CommonSlicerMeasurements} (and hence from
	 * the `total`), so that they cannot distort any of the existing measurements.
	 * A failing phase is logged and skipped, it never aborts the benchmark.
	 * @param calibrate - whether to run the calibration, which describes the machine and hence only has to run for some files of a suite
	 */
	public async measureAdditionalPhases(calibrate = true): Promise<void> {
		this.totalStopwatch.pause();
		try {
			this.guardActive();
			const analyzer = await this.buildAnalyzerForAdditionalPhases();
			if(analyzer !== undefined) {
				await this.measureAdditional('dependencies query', () => analyzer.query([{ type: 'dependencies' }]));
				await this.measureAdditional('linter run', () => analyzer.query([{ type: 'linter' }]));
			}
			if(calibrate) {
				/* the calibration times itself, so that neither the warmup nor the reps it discards count */
				this.additionalMeasurements.set('calibration', runCalibration());
			}
		} catch(e: unknown) {
			benchmarkLogger.error(`failed to measure the additional phases: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			this.totalStopwatch.resume();
		}
	}

	/**
	 * The additional phases work on the analyzer api, so we have to set up an analyzer for the same request.
	 * All of its analyses happen before the measurement starts.
	 */
	private async buildAnalyzerForAdditionalPhases(): Promise<ReadonlyFlowrAnalysisProvider | undefined> {
		try {
			guard(this.config !== undefined && this.request !== undefined, 'need to call init before the additional phases');
			const analyzer = new FlowrAnalyzerBuilder()
				.setParser(this.parser)
				.setConfig(this.config)
				.buildSync();
			analyzer.addRequest({ ...this.request });
			await analyzer.runFull();
			return analyzer;
		} catch(e: unknown) {
			benchmarkLogger.error(`failed to set up the analyzer for the additional phases: ${e instanceof Error ? e.message : String(e)}`);
			return undefined;
		}
	}

	private async measureAdditional(keyToMeasure: AdditionalSlicerMeasurements, measurement: () => unknown): Promise<void> {
		const start = process.hrtime.bigint();
		try {
			await measurement();
		} catch(e: unknown) {
			benchmarkLogger.error(`failed to measure '${keyToMeasure}': ${e instanceof Error ? e.message : String(e)}`);
			return;
		}
		this.additionalMeasurements.set(keyToMeasure, process.hrtime.bigint() - start);
	}

	private getInferredRange<T>(value: SetRangeDomain<T> | PosIntervalDomain): number {
		if(value.isValue()) {
			if(value instanceof SetRangeDomain) {
				return value.isFinite() ? value.may.size : Infinity;
			} else {
				return value.upper - value.lower;
			}
		}
		return 0;
	}

	private getInferredNumber<T>(value: SetRangeDomain<T> | PosIntervalDomain): number | 'bottom' | 'infinite' | 'top' {
		if(value.isTop()) {
			return 'top';
		} else if(value.isValue()) {
			if(!value.isFinite()) {
				return 'infinite';
			} else if(value instanceof SetRangeDomain) {
				return Math.floor(value.value.must.size + (value.value.may.size / 2));
			} else {
				return Math.floor((value.lower + value.upper) / 2);
			}
		}
		return 'bottom';
	}

	/** Bridging the gap between the new internal and the old names for the benchmarking */
	private async measureCommonStep<Step extends PipelineStepNames<SupportedPipelines>>(
		expectedStep: Step,
		keyToMeasure: CommonSlicerMeasurements
	): Promise<PipelineStepOutputWithName<SupportedPipelines, Step>> {
		const memoryInit = process.memoryUsage();
		const { result } = await this.commonMeasurements.measureAsync(
			keyToMeasure, () => this.executor.nextStep(expectedStep)
		);
		this.recordMemoryDelta(keyToMeasure, memoryInit);
		return result as PipelineStepOutputWithName<SupportedPipelines, Step>;
	}

	/** Stores what the step measured as `keyToMeasure` added to the memory usage it started with. */
	private recordMemoryDelta(keyToMeasure: CommonSlicerMeasurements, memoryInit: NodeJS.MemoryUsage): void {
		const memoryEnd = process.memoryUsage();
		this.deltas.set(keyToMeasure, {
			heap:     memoryEnd.heapUsed - memoryInit.heapUsed,
			rss:      memoryEnd.rss - memoryInit.rss,
			external: memoryEnd.external - memoryInit.external,
			buffs:    memoryEnd.arrayBuffers - memoryInit.arrayBuffers
		});
	}

	private measureSimpleStep<Out>(
		keyToMeasure: CommonSlicerMeasurements,
		measurement: () => Out
	): Out {
		const memoryInit = process.memoryUsage();
		const result = this.commonMeasurements.measure(
			keyToMeasure, measurement
		);
		this.recordMemoryDelta(keyToMeasure, memoryInit);
		return result;
	}

	private async measureSliceStep<Step extends PipelineStepNames<SupportedPipelines>>(
		expectedStep: Step,
		measure: Measurements<PerSliceMeasurements>,
		keyToMeasure: PerSliceMeasurements
	): Promise<PipelineStepOutputWithName<SupportedPipelines, Step>> {
		const { result } = await measure.measureAsync(
			keyToMeasure, () => this.executor.nextStep(expectedStep)
		);

		return result as PipelineStepOutputWithName<SupportedPipelines, Step>;
	}

	private guardActive() {
		guard(this.stats !== undefined && !this.finished, 'need to call init before, and can not do after finish!');
	}

	/**
	 * Call {@link slice} for all slicing criteria that match the given filter.
	 * See {@link collectAllSlicingCriteria} for details.
	 * <p>
	 * the `report` function will be called *before* each *individual* slice is performed.
	 * @returns The number of slices that were produced
	 * @see collectAllSlicingCriteria
	 * @see SlicingCriteriaFilter
	 */
	public async sliceForAll(
		filter: SlicingCriteriaFilter,
		report: (current: number, total: number, allCriteria: SlicingCriteria[]) => void = () => { /* do nothing */ },
		options: {
			sampleCount?:    number,
			maxSliceCount?:  number,
			sampleStrategy?: SamplingStrategy,
			seed?:           string
		} = {},
	): Promise<number> {
		const { sampleCount, maxSliceCount, sampleStrategy } = { sampleCount: -1, maxSliceCount: -1, sampleStrategy: 'random', ...options };
		this.guardActive();
		let count = 0;
		let allCriteria = [...collectAllSlicingCriteria((this.normalizedAst as NormalizedAst).ast, filter)];
		// Cancel slicing if the number of slices exceeds the limit
		if(maxSliceCount > 0 && allCriteria.length > maxSliceCount) {
			return -allCriteria.length;
		}
		if(sampleCount > 0) {
			if(sampleStrategy === 'equidistant') {
				allCriteria = equidistantSampling(allCriteria, sampleCount, 'ceil');
			} else {
				const random = options.seed ? seedrandom(options.seed) : Math.random;
				allCriteria.sort(() => random() - 0.5);
				allCriteria.length = Math.min(allCriteria.length, sampleCount);
			}
		}
		for(const slicingCriteria of allCriteria) {
			report(count, allCriteria.length, allCriteria);
			await this.slice(...slicingCriteria);
			count++;
		}
		return count;
	}

	/**
	 * Retrieves the final stats and closes the shell session.
	 * Can be called multiple times to retrieve the stored stats, but will only close the session once (the first time).
	 */
	public finish(): BenchmarkSlicerStats {
		guard(this.stats !== undefined, 'need to call init before finish');

		if(!this.finished) {
			this.commonMeasurements.measure(
				'close R session',
				() => this.parser.close()
			);
			this.totalStopwatch.stop();
			this.finished = true;
		}

		this.stats.commonMeasurements = this.commonMeasurements.get();
		const retrieveTime = Number(this.stats.commonMeasurements.get('retrieve AST from R code'));
		const normalizeTime = Number(this.stats.commonMeasurements.get('normalize R AST'));
		const dataflowTime = Number(this.stats.commonMeasurements.get('produce dataflow information'));
		const controlFlowTime = Number(this.stats.commonMeasurements.get('extract control flow graph'));
		const callGraphTime = Number(this.stats.commonMeasurements.get('extract call graph'));
		const dataFrameShapeTime = Number(this.stats.commonMeasurements.get('infer data frame shapes'));

		this.stats.retrieveTimePerToken = {
			raw:        retrieveTime / this.stats.input.numberOfRTokens,
			normalized: retrieveTime / this.stats.input.numberOfNormalizedTokens
		};
		this.stats.normalizeTimePerToken = {
			raw:        normalizeTime / this.stats.input.numberOfRTokens,
			normalized: normalizeTime / this.stats.input.numberOfNormalizedTokens
		};
		this.stats.dataflowTimePerToken = {
			raw:        dataflowTime / this.stats.input.numberOfRTokens,
			normalized: dataflowTime / this.stats.input.numberOfNormalizedTokens
		};
		this.stats.totalCommonTimePerToken = {
			raw:        (retrieveTime + normalizeTime + dataflowTime) / this.stats.input.numberOfRTokens,
			normalized: (retrieveTime + normalizeTime + dataflowTime) / this.stats.input.numberOfNormalizedTokens
		};
		this.stats.controlFlowTimePerToken = Number.isNaN(controlFlowTime) ? undefined : {
			raw:        controlFlowTime / this.stats.input.numberOfRTokens,
			normalized: controlFlowTime / this.stats.input.numberOfNormalizedTokens,
		};
		this.stats.callGraphTimePerToken = Number.isNaN(callGraphTime) ? undefined : {
			raw:        callGraphTime / this.stats.input.numberOfRTokens,
			normalized: callGraphTime / this.stats.input.numberOfNormalizedTokens,
		};
		this.stats.dataFrameShapeTimePerToken = Number.isNaN(dataFrameShapeTime) ? undefined : {
			raw:        dataFrameShapeTime / this.stats.input.numberOfRTokens,
			normalized: dataFrameShapeTime / this.stats.input.numberOfNormalizedTokens,
		};

		const per100Lines = 100 / this.stats.input.numberOfLines;
		this.stats.retrieveTimePer100Lines = retrieveTime * per100Lines;
		this.stats.normalizeTimePer100Lines = normalizeTime * per100Lines;
		this.stats.dataflowTimePer100Lines = dataflowTime * per100Lines;
		this.stats.totalCommonTimePer100Lines = (retrieveTime + normalizeTime + dataflowTime) * per100Lines;
		this.stats.controlFlowTimePer100Lines = Number.isNaN(controlFlowTime) ? undefined : controlFlowTime * per100Lines;

		return {
			stats:     this.stats,
			parse:     typeof this.loadedXml === 'string' ? this.loadedXml : JSON.stringify(this.loadedXml),
			dataflow:  this.dataflow as DataflowInformation,
			normalize: this.normalizedAst as NormalizedAst
		};
	}

	/**
	 * Only call in case of an error - if the session must be closed and the benchmark itself is to be considered failed/dead.
	 */
	public ensureSessionClosed(): void {
		this.parser?.close();
	}
}
