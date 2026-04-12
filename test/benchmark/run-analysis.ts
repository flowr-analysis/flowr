import * as path from 'path';
import * as fs from 'fs';
import * as process from 'process';
import { FlowrAnalyzerBuilder } from '../../src/project/flowr-analyzer-builder';
import { diffOfDataflowGraphs } from '../../src/dataflow/graph/diff-dataflow-graph';
import type { FlowrAnalyzer } from '../../src/project/flowr-analyzer';
import type { DataflowGraph } from '../../src/dataflow/graph/graph';
import { edgeIncludesType, EdgeType } from '../../src/dataflow/graph/edge';
import type {
	OptimizationFlags,
	WorkerResult,
	LazyFunctionStats,
	GraphMetrics,
	SourceCharacteristics,
	GraphCheck,
	SequentialReanalysisInfo,
} from './results-types';
import { CorrectnessClassification } from './results-types';
import { VertexType } from '../../src/dataflow/graph/vertex';

// -------------------- analyzer builders --------------------
async function buildOptimizedAnalyzer(flags: OptimizationFlags): Promise<FlowrAnalyzer> {
	const builder = new FlowrAnalyzerBuilder();
	builder.amendConfig((config) => {
		config.optimizations.fileParallelization = flags.parallelFiles;
		config.optimizations.dataflowOperationParallelization = flags.parallelOperations;
		config.optimizations.deferredFunctionEvaluation.enabled = flags.lazyFunctions;
	});
	return builder.build();
}

// -------------------- graph compare --------------------
function runGraphCheck(
	left: DataflowGraph,
	right: DataflowGraph,
	leftName: string,
	rightName: string,
	config?: { leftIsSubgraph?: boolean; rightIsSubgraph?: boolean },
): GraphCheck {
	const diff = diffOfDataflowGraphs(
		{ name: leftName, graph: left },
		{ name: rightName, graph: right },
		config,
	);
	const comments = diff.comments();
	return { ok: diff.isEqual(), diffCount: comments?.length ?? 0, diff: comments };
}

function compareGraphs(base: DataflowGraph, opt: DataflowGraph, lazyEvaluationEnabled: boolean): Exclude<WorkerResult['correctness'], 'skipped'> {
	// Step 1 (lazy only): optimized graph may be partial but must remain a subgraph of sequential baseline.
	let lazyEquality: GraphCheck | undefined;
	if(lazyEvaluationEnabled) {
		lazyEquality = runGraphCheck(opt, base, 'Optimized (lazy)', 'Baseline (sequential)', { leftIsSubgraph: true });
		// Step 2: Force full materialization and require full equality for precision.
		opt.materializeAll();
	}

	// Step 3: compare full graph
	const fullEquality = runGraphCheck(base, opt, 'Baseline (materialized)', 'Optimized (materialized)');

	let impreciseEquality: GraphCheck | undefined;
	let classification: CorrectnessClassification;
	let primaryDiff: GraphCheck;

	if(lazyEquality && !lazyEquality.ok) {
		classification = CorrectnessClassification.Incorrect;
		primaryDiff = lazyEquality;
	} else if(fullEquality.ok) {
		classification = CorrectnessClassification.Correct;
		primaryDiff = fullEquality;
	} else {
		// Step 4: If full equality fails, classify as imprecise when baseline is still a subgraph.
		impreciseEquality = runGraphCheck(
			base,
			opt,
			'Baseline (materialized)',
			'Optimized (materialized)',
			{ leftIsSubgraph: true }
		);
		if(impreciseEquality.ok) {
			classification = CorrectnessClassification.Imprecise;
			primaryDiff = fullEquality;
		} else {
			classification = CorrectnessClassification.Incorrect;
			primaryDiff = fullEquality;
		}
	}

	return {
		classification,
		diffCount: primaryDiff.diffCount,
		diff:      primaryDiff.diff,
	};
}

// -------------------- file counting --------------------
function countFiles(dir: string): number {
	let total = 0;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for(const e of entries) {
		const fullPath = path.join(dir, e.name);
		if(e.isDirectory()) {
			total += countFiles(fullPath);
		} else {
			total += 1;
		}
	}
	return total;
}

// -------------------- metadata collectors (outside measurements) --------------------

/**
 * Extract graph metrics from dataflow graph
 */
function extractGraphMetrics(graph: DataflowGraph): GraphMetrics {
	const nodeTypeDistribution: Record<string, number> = {};
	let totalNodeCount = 0;
	let sideEffectCount = 0;

	// Count nodes by type using the actual API
	for(const type of Object.values(VertexType)) {
		const ids = graph.vertexIdsOfType(type);
		if(ids.length > 0) {
			nodeTypeDistribution[type] = ids.length;
			totalNodeCount += ids.length;
		}
	}

	// Count explicit side-effect-on-call edges.
	for(const [, outgoingEdges] of graph.edges()) {
		for(const [, edge] of outgoingEdges) {
			if(edgeIncludesType(edge.types, EdgeType.SideEffectOnCall)) {
				sideEffectCount++;
			}
		}
	}

	return {
		nodeCount: totalNodeCount,
		nodeTypeDistribution,
		sideEffectCount,
	};
}

/**
 * Analyze source code characteristics
 */
function analyzeSourceCharacteristics(projectPath: string): SourceCharacteristics {
	let lineCount = 0;
	let totalBytes = 0;
	let fileCount = 0;

	function scanDir(dir: string) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for(const e of entries) {
			const fullPath = path.join(dir, e.name);
			if(e.isDirectory()) {
				scanDir(fullPath);
			} else {
				try {
					const stats = fs.statSync(fullPath);
					totalBytes += stats.size;
					fileCount++;

					// Count lines only for R files
					if(path.extname(e.name).toLowerCase() === '.r') {
						const content = fs.readFileSync(fullPath, 'utf-8');
						lineCount += content.split('\n').length;
					}
				} catch{
					// Skip files we can't read
				}
			}
		}
	}

	scanDir(projectPath);
	return { lineCount, totalBytes, fileCount };
}

// -------------------- runner --------------------
async function runOnce(
	projectPath: string,
	buildAnalyzer: () => Promise<FlowrAnalyzer>,
	captureGraph: boolean = false,
) {
	const analyzer = await buildAnalyzer();
	analyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });

	/** compute parsing and normailization  */
	await analyzer.normalize();


	const result = await analyzer.dataflow();

	return {
		wallMs:              result['.meta'].timing,
		graph:               captureGraph ? result.graph : undefined,
		reanalysisTriggered: result.reanalysisTriggered,
		reanalysisIteration: result.reanalysisIteration,
		reanalysisFileIndex: result.reanalysisFileIndex,
	};
}

// -------------------- main --------------------
async function main(): Promise<void> {
	const projectPath = process.argv[2];
	const outputDir = process.argv[3];
	const repetitions = Number(process.argv[4] ?? '10');

	if(!projectPath || !outputDir) {
		console.error('Usage: ts-node run-analysis.ts <projectPath> <outputDir> [repetitions] ...flags');
		process.exit(1);
	}

	const flags: OptimizationFlags = {
		parallelFiles:      process.argv.includes('--parallelFiles'),
		parallelOperations: process.argv.includes('--parallelOperations'),
		lazyFunctions:      process.argv.includes('--lazyFunctions'),
	};

	const skipCorrectness = process.argv.includes('--skipCorrectness');
	const dryRun = process.argv.includes('--dryRun');

	if(dryRun) {
		const analyzer = await buildOptimizedAnalyzer(flags);
		console.log('[dry-run] project would be executed:', path.resolve(projectPath));
		console.log('[dry-run] output directory:', path.resolve(outputDir));
		console.log('[dry-run] repetitions:', repetitions);
		console.log('[dry-run] skip correctness:', skipCorrectness);
		console.log('[dry-run] benchmark flags:', JSON.stringify(flags));
		const fileParallelization = analyzer.flowrConfig.optimizations.fileParallelization;
		const dataflowOperationParallelization = analyzer.flowrConfig.optimizations.dataflowOperationParallelization;
		const deferredFunctionEvaluation = analyzer.flowrConfig.optimizations.deferredFunctionEvaluation;
		console.log('[dry-run] analyzer internal optimizations:', JSON.stringify({
			fileParallelization,
			dataflowOperationParallelization,
			deferredFunctionEvaluation,
		}, null, 2));
		return;
	}

	fs.mkdirSync(outputDir, { recursive: true });
	const fileCount = countFiles(projectPath);

	// -------------------- metadata collection (before measurements) --------------------
	console.log('Collecting source characteristics...');
	const sourceCharacteristics = analyzeSourceCharacteristics(projectPath);

	// -------------------- correctness --------------------
	let correctness: WorkerResult['correctness'] = 'skipped';

	if(!skipCorrectness) {
		console.log('Running correctness check...');

		const baseAnalyzer = (await new FlowrAnalyzerBuilder().build());
		baseAnalyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });
		const baseDf = await baseAnalyzer.dataflow();

		const optAnalyzer = (await buildOptimizedAnalyzer(flags));
		optAnalyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });
		const optDf = await optAnalyzer.dataflow();

		correctness = compareGraphs(baseDf.graph, optDf.graph, flags.lazyFunctions);

		if(correctness.classification === CorrectnessClassification.Incorrect && correctness.diff) {
			console.warn('Correctness check failed! Graphs differ:');
			correctness.diff.forEach((l) => console.error(l));
		}
	}

	// -------------------- measurement --------------------
	console.log('Measuring optimized performance...');
	const wallMsArr: number[] = [];
	let lazyStats: LazyFunctionStats | undefined;
	let graphMetrics: GraphMetrics | undefined;
	let sequentialReanalysis: SequentialReanalysisInfo | undefined;

	for(let i = 0; i < repetitions; i++) {
		const captureGraph = i === 0; // Capture graph from first run to extract stats
		const run = await runOnce(projectPath, () => buildOptimizedAnalyzer(flags), captureGraph);
		wallMsArr.push(run.wallMs);

		// Collect metadata from first run (analysis is deterministic)
		if(i === 0 && run.graph) {
			sequentialReanalysis = {
				triggered: run.reanalysisTriggered ?? false,
				iteration: run.reanalysisIteration,
				fileIndex: run.reanalysisFileIndex,
			};

			const graphStats = run.graph.getLazyFunctionStatistics();
			lazyStats = {
				totalFunctionDefinitions:  graphStats.totalFunctionDefinitions,
				lazyFunctionsMaterialized: graphStats.lazyFunctionsMaterialized,
				lazyFunctionsRemaining:    graphStats.totalFunctionDefinitions - graphStats.lazyFunctionsMaterialized,
			};

			// Extract graph metrics (outside perf measurement)
			graphMetrics = extractGraphMetrics(run.graph);
		}
	}

	const result: WorkerResult = {
		project:              path.resolve(projectPath),
		threads:              undefined,
		correctness,
		fileCount,
		timestamp:            new Date().toISOString(),
		wallMs:               wallMsArr,
		lazyFunctionStats:    lazyStats,
		sequentialReanalysis: sequentialReanalysis,
		graphMetrics,
		sourceCharacteristics,
	};

	fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2), 'utf-8');
}

main().catch((err: unknown) => {
	console.error('Analysis failed:', err);
	process.exit(1);
});
