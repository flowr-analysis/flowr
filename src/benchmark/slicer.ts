/**
 * Provides a top-level slicer that can be used to slice code *and* retrieve stats.
 * @module
 */

import type { IStoppableStopwatch } from './stopwatch';
import { Measurements } from './stopwatch';
import fs from 'fs';
import { log, LogLevel } from '../util/log';
import type { MergeableRecord } from '../util/objects';
import type { DataflowInformation } from '../dataflow/info';
import type { SliceResult } from '../slicing/static/slicer-types';
import type { ReconstructionResult } from '../reconstruct/reconstruct';
import type { PipelineExecutor } from '../core/pipeline-executor';
import { guard } from '../util/assert';
import { withoutWhitespace } from '../util/strings';
import type {
	BenchmarkMemoryMeasurement,
	CommonSlicerMeasurements,
	ElapsedTime,
	PerSliceMeasurements,
	PerSliceStats,
	SlicerStats
} from './stats/stats';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SlicingCriteria } from '../slicing/criterion/parse';
import type { TREE_SITTER_SLICING_PIPELINE, DEFAULT_SLICING_PIPELINE } from '../core/steps/pipeline/default-pipelines';
import { createSlicePipeline } from '../core/steps/pipeline/default-pipelines';


import type { RParseRequestFromFile, RParseRequestFromText } from '../r-bridge/retriever';
import { retrieveNumberOfRTokensOfLastParse } from '../r-bridge/retriever';
import type { PipelineStepNames, PipelineStepOutputWithName } from '../core/steps/pipeline/pipeline';
import type { SlicingCriteriaFilter } from '../slicing/criterion/collect-all';
import { collectAllSlicingCriteria } from '../slicing/criterion/collect-all';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { visitAst } from '../r-bridge/lang-4.x/ast/model/processing/visitor';
import { getSizeOfDfGraph } from './stats/size-of';
import type { AutoSelectPredicate } from '../reconstruct/auto-select/auto-select-defaults';
import type { KnownParser, KnownParserName, KnownParserType } from '../r-bridge/parser';
import type { SyntaxNode, Tree } from 'web-tree-sitter';
import { RShell } from '../r-bridge/shell';
import { TreeSitterType } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-types';
import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { InGraphIdentifierDefinition } from '../dataflow/environments/identifier';
import type { ContainerIndicesCollection } from '../dataflow/graph/vertex';
import { isParentContainerIndex } from '../dataflow/graph/vertex';

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
 * A slicer that can be used to slice exactly one file (multiple times).
 * It holds its own {@link RShell} instance, maintains a cached dataflow and keeps measurements.
 *
 * Make sure to call {@link init} to initialize the slicer, before calling {@link slice}.
 * After slicing, call {@link finish} to close the R session and retrieve the stats.
 *
 * @note Under the hood, the benchmark slicer maintains a {@link PipelineExecutor} using the {@link DEFAULT_SLICING_PIPELINE} or the {@link TREE_SITTER_SLICING_PIPELINE}.
 */
type SupportedPipelines = typeof DEFAULT_SLICING_PIPELINE | typeof TREE_SITTER_SLICING_PIPELINE
export class BenchmarkSlicer {
	/** Measures all data recorded *once* per slicer (complete setup up to the dataflow graph creation) */
	private readonly commonMeasurements   = new Measurements<CommonSlicerMeasurements>();
	private readonly perSliceMeasurements = new Map<SlicingCriteria, PerSliceStats>();
	private readonly deltas               = new Map<CommonSlicerMeasurements, BenchmarkMemoryMeasurement>();
	private readonly parserName: KnownParserName;
	private stats:               SlicerStats | undefined;
	private loadedXml:           KnownParserType | undefined;
	private dataflow:            DataflowInformation | undefined;
	private normalizedAst:       NormalizedAst | undefined;
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
	public async init(request: RParseRequestFromFile | RParseRequestFromText, autoSelectIf?: AutoSelectPredicate) {
		guard(this.stats === undefined, 'cannot initialize the slicer twice');

		// we know these are in sync so we just cast to one of them
		this.parser = await this.commonMeasurements.measure(
			'initialize R session', async() => {
				if(this.parserName === 'r-shell') {
					return new RShell();
				} else {
					await TreeSitterExecutor.initTreeSitter();
					return new TreeSitterExecutor();
				}
			}
		);
		this.executor = createSlicePipeline(this.parser, {
			request:   { ...request },
			criterion: [],
			autoSelectIf
		});

		this.loadedXml = (await this.measureCommonStep('parse', 'retrieve AST from R code')).parsed;
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
			const root = (this.loadedXml as Tree).rootNode;
			numberOfRTokens = countChildren(root);
			numberOfRTokensNoComments = countChildren(root, true);
		}

		guard(this.normalizedAst !== undefined, 'normalizedAst should be defined after initialization');
		guard(this.dataflow !== undefined, 'dataflow should be defined after initialization');

		// collect dataflow graph size
		const vertices = [...this.dataflow.graph.vertices(true)];
		let numberOfEdges = 0;
		let numberOfCalls = 0;
		let numberOfDefinitions = 0;

		for(const [n, info] of vertices) {
			const outgoingEdges = this.dataflow.graph.outgoingEdges(n);
			numberOfEdges += outgoingEdges?.size ?? 0;
			if(info.tag === 'function-call') {
				numberOfCalls++;
			} else if(info.tag === 'function-definition') {
				numberOfDefinitions++;
			}
		}

		let nodes = 0;
		let nodesNoComments = 0;
		let commentChars = 0;
		let commentCharsNoWhitespace = 0;
		visitAst(this.normalizedAst.ast, t => {
			nodes++;
			const comments = t.info.additionalTokens?.filter(t => t.type === RType.Comment);
			if(comments && comments.length > 0) {
				const content = comments.map(c => c.lexeme ?? '').join('');
				commentChars += content.length;
				commentCharsNoWhitespace += withoutWhitespace(content).length;
			} else {
				nodesNoComments++;
			}
			return false;
		});

		const storedIndices = this.countStoredPointerIndices();

		const split = loadedContent.split('\n');
		const nonWhitespace = withoutWhitespace(loadedContent).length;
		this.stats = {
			perSliceMeasurements: this.perSliceMeasurements,
			memory:               this.deltas,
			request,
			input:                {
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
				numberOfNodes:               [...this.dataflow.graph.vertices(true)].length,
				numberOfEdges:               numberOfEdges,
				numberOfCalls:               numberOfCalls,
				numberOfFunctionDefinitions: numberOfDefinitions,
				sizeOfObject:                getSizeOfDfGraph(this.dataflow.graph),
				storedIndices:               storedIndices
			},

			// these are all properly initialized in finish()
			commonMeasurements:      new Map<CommonSlicerMeasurements, ElapsedTime>(),
			retrieveTimePerToken:    { raw: 0, normalized: 0 },
			normalizeTimePerToken:   { raw: 0, normalized: 0 },
			dataflowTimePerToken:    { raw: 0, normalized: 0 },
			totalCommonTimePerToken: { raw: 0, normalized: 0 }
		};
	}

	/**
	 * Counts the number of stored indices in the dataflow graph created by the pointer analysis.
	 */
	private countStoredPointerIndices(): number {
		let numberOfIndices = 0;
		for(const reference of this.dataflow?.out ?? []) {
			const graphReference = reference as InGraphIdentifierDefinition;
			if(graphReference.indicesCollection) {
				numberOfIndices += this.countIndices(graphReference.indicesCollection);
			}
		}
		return numberOfIndices;
	}

	/**
	 * Recursively counts the number of indices and sub-indices in the given collection.
	 */
	private countIndices(collection: ContainerIndicesCollection): number {
		let numberOfIndices = 0;
		for(const indices of collection ?? []) {
			for(const index of indices.indices) {
				numberOfIndices++;
				if(isParentContainerIndex(index)) {
					numberOfIndices += this.countIndices(index.subIndices);
				}
			}
		}
		return numberOfIndices;
	}

	/**
	 * Slice for the given {@link SlicingCriteria}.
	 * @see SingleSlicingCriterion
	 *
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
		stats.slicingCriteria = [...slicedOutput.decodedCriteria];

		stats.reconstructedCode = await this.measureSliceStep('reconstruct', measurements, 'reconstruct code');

		totalStopwatch.stop();

		benchmarkLogger.debug(`Produced code for ${JSON.stringify(slicingCriteria)}: ${stats.reconstructedCode.code}`);
		const results = this.executor.getResults(false);

		if(benchmarkLogger.settings.minLevel >= LogLevel.Info) {
			benchmarkLogger.info(`mapped slicing criteria: ${slicedOutput.decodedCriteria.map(c => {
				const node = results.normalize.idMap.get(c.id);
				return `\n-   id: ${c.id}, location: ${JSON.stringify(node?.location)}, lexeme: ${JSON.stringify(node?.lexeme)}`;
			}).join('')}`);
		}

		// if it is not in the dataflow graph it was kept to be safe and should not count to the included nodes
		stats.numberOfDataflowNodesSliced = [...slicedOutput.result].filter(id => results.dataflow.graph.hasVertex(id, false)).length;
		stats.timesHitThreshold = slicedOutput.timesHitThreshold;

		stats.measurements = measurements.get();
		return {
			stats,
			slice: slicedOutput,
			code:  stats.reconstructedCode
		};
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
		const memoryEnd = process.memoryUsage();
		this.deltas.set(keyToMeasure, {
			heap:     memoryEnd.heapUsed - memoryInit.heapUsed,
			rss:      memoryEnd.rss - memoryInit.rss,
			external: memoryEnd.external - memoryInit.external,
			buffs:    memoryEnd.arrayBuffers - memoryInit.arrayBuffers
		});
		return result as PipelineStepOutputWithName<SupportedPipelines, Step>;
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
	 *
	 * @returns The number of slices that were produced
	 *
	 * @see collectAllSlicingCriteria
	 * @see SlicingCriteriaFilter
	 */
	public async sliceForAll(
		filter: SlicingCriteriaFilter,
		report: (current: number, total: number, allCriteria: SlicingCriteria[]) => void = () => { /* do nothing */ },
		sampleRandom = -1
	): Promise<number> {
		this.guardActive();
		let count = 0;
		const allCriteria = [...collectAllSlicingCriteria((this.normalizedAst as NormalizedAst).ast, filter)];
		if(sampleRandom > 0) {
			allCriteria.sort(() => Math.random() - 0.5);
			allCriteria.length = Math.min(allCriteria.length, sampleRandom);
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
		this.stats.totalCommonTimePerToken= {
			raw:        (retrieveTime + normalizeTime + dataflowTime) / this.stats.input.numberOfRTokens,
			normalized: (retrieveTime + normalizeTime + dataflowTime) / this.stats.input.numberOfNormalizedTokens
		};
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
