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
	AnalysisRunResult,
	LazyFunctionStats,
	GraphMetrics,
	SourceCharacteristics,
	GraphCheck,
} from './results-types';
import { CorrectnessClassification } from './results-types';
import { VertexType } from '../../src/dataflow/graph/vertex';

const tempResultRelativePath = './.tmp-analysis-result.json';

function readArgValue(name: string): string | undefined {
	const idx = process.argv.indexOf(name);
	if(idx < 0 || idx + 1 >= process.argv.length) {
		return undefined;
	}
	return process.argv[idx + 1];
}

// -------------------- analyzer builders --------------------
async function buildOptimizedAnalyzer(flags: OptimizationFlags, threads?: number): Promise<FlowrAnalyzer> {
	const builder = new FlowrAnalyzerBuilder();
	builder.amendConfig((config) => {
		config.optimizations.fileParallelization = flags.parallelFiles;
		config.optimizations.dataflowOperationParallelization = flags.parallelOperations;
		config.optimizations.deferredFunctionEvaluation.enabled = flags.lazyFunctions;
		if(threads !== undefined && threads > 0) {
			config.workerPool.poolSettings.nofMaxWorkers = threads;
			config.workerPool.poolSettings.nofMinWorkers = Math.min(config.workerPool.poolSettings.nofMinWorkers, threads);
		}
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
	return { ok: diff.isEqual(), diffCount: comments?.length ?? 0 };
}

function compareGraphs(base: DataflowGraph, opt: DataflowGraph, lazyEvaluationEnabled: boolean): Exclude<AnalysisRunResult['correctness'], 'skipped'> {
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
	try {
		analyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });

		/** compute parsing and normailization  */
		await analyzer.normalize();


		const result = await analyzer.dataflow();
		const timingBreakdown = result.timings;

		return {
			wallMs:              result['.meta'].timing,
			timingBreakdown,
			graph:               captureGraph ? result.graph : undefined,
			reanalysisTriggered: result.reanalysisTriggered,
			reanalysisIteration: result.reanalysisIteration,
			reanalysisFileIndex: result.reanalysisFileIndex,
		};
	} finally {
		await analyzer.close(true);
	}
}

// -------------------- main --------------------
async function main(): Promise<void> {
	const projectPath = process.argv[2];
	const outputDir = process.argv[3];

	if(!projectPath || !outputDir) {
		console.error('Usage: ts-node run-analysis.ts <projectPath> <outputDir> ...flags');
		process.exit(1);
	}

	const flags: OptimizationFlags = {
		parallelFiles:      process.argv.includes('--parallelFiles'),
		parallelOperations: process.argv.includes('--parallelOperations'),
		lazyFunctions:      process.argv.includes('--lazyFunctions'),
	};

	const skipCorrectness = process.argv.includes('--skipCorrectness');
	const runtimeOnly = process.argv.includes('--runtimeOnly');
	const dryRun = process.argv.includes('--dryRun');
	const tempResultPathArg = readArgValue('--tempResultPath');
	const threadArg = readArgValue('--threads');
	const threads = threadArg !== undefined ? Number.parseInt(threadArg, 10) : undefined;
	if(threads !== undefined && (!Number.isFinite(threads) || threads <= 0)) {
		throw new Error(`Invalid --threads value: ${threadArg}`);
	}

	if(dryRun) {
		const analyzer = await buildOptimizedAnalyzer(flags, threads);
		console.log('[dry-run] project would be executed:', path.resolve(projectPath));
		console.log('[dry-run] output directory:', path.resolve(outputDir));
		console.log('[dry-run] temp result path:', tempResultPathArg ? path.resolve(tempResultPathArg) : path.resolve(outputDir, tempResultRelativePath));
		console.log('[dry-run] skip correctness:', skipCorrectness);
		console.log('[dry-run] requested threads:', threads ?? 'default');
		console.log('[dry-run] benchmark flags:', JSON.stringify(flags));
		const fileParallelization = analyzer.flowrConfig.optimizations.fileParallelization;
		const dataflowOperationParallelization = analyzer.flowrConfig.optimizations.dataflowOperationParallelization;
		const deferredFunctionEvaluation = analyzer.flowrConfig.optimizations.deferredFunctionEvaluation;
		const poolSettings = analyzer.flowrConfig.workerPool.poolSettings;
		console.log('[dry-run] analyzer internal optimizations:', JSON.stringify({
			fileParallelization,
			dataflowOperationParallelization,
			deferredFunctionEvaluation,
			workerPool: {
				nofMinWorkers: poolSettings.nofMinWorkers,
				nofMaxWorkers: poolSettings.nofMaxWorkers,
			}
		}, null, 2));
		return;
	}

	fs.mkdirSync(outputDir, { recursive: true });
	const tempResultPath = tempResultPathArg ? path.resolve(tempResultPathArg) : path.resolve(outputDir, tempResultRelativePath);
	const fileCount = countFiles(projectPath);

	// -------------------- metadata collection (before measurements) --------------------
	const sourceCharacteristics = runtimeOnly ? undefined : (() => {
		console.log('Collecting source characteristics...');
		return analyzeSourceCharacteristics(projectPath);
	})();

	// -------------------- measurement --------------------
	console.log('Measuring optimized performance...');
	let wallMs = 0;
	let lazyStats: LazyFunctionStats | undefined;
	let graphMetrics: GraphMetrics | undefined;
	let sequentialReanalysis: boolean | undefined;
	const captureGraph = !runtimeOnly;
	const run = await runOnce(projectPath, () => buildOptimizedAnalyzer(flags, threads), captureGraph);
	wallMs = run.wallMs;

	if(captureGraph && run.graph) {
		sequentialReanalysis = run.reanalysisTriggered ?? false;

		const graphStats = run.graph.getLazyFunctionStatistics();
		lazyStats = {
			totalFunctionDefinitions:  graphStats.totalFunctionDefinitions,
			lazyFunctionsMaterialized: graphStats.lazyFunctionsMaterialized,
			lazyFunctionsRemaining:    graphStats.totalFunctionDefinitions - graphStats.lazyFunctionsMaterialized,
		};

		// Extract graph metrics (outside perf measurement)
		graphMetrics = extractGraphMetrics(run.graph);
	}

	// -------------------- correctness --------------------
	let correctness: AnalysisRunResult['correctness'] = 'skipped';

	if(!runtimeOnly && !skipCorrectness) {
		console.log('Running correctness check...');

		const baseAnalyzer = (await new FlowrAnalyzerBuilder().build());
		let baseDf;
		try {
			baseAnalyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });
			baseDf = await baseAnalyzer.dataflow();
		} finally {
			await baseAnalyzer.close(true);
		}

		if(!run.graph) {
			throw new Error('Expected captured optimized graph for correctness check, but none was available.');
		}

		correctness = compareGraphs(baseDf.graph, run.graph, flags.lazyFunctions);

		if(correctness.classification === CorrectnessClassification.Incorrect) {
			console.warn(`Correctness check failed! Number of diff comments: ${correctness.diffCount}`);
		}
	}

	const result: AnalysisRunResult = {
		project:              path.resolve(projectPath),
		fileCount,
		timestamp:            new Date().toISOString(),
		wallMs,
		timingBreakdown:      run.timingBreakdown,
		correctness,
		lazyFunctionStats:    lazyStats,
		sequentialReanalysis: sequentialReanalysis,
		graphMetrics,
		sourceCharacteristics,
	};

	fs.writeFileSync(tempResultPath, JSON.stringify(result, null, 2), 'utf-8');
}

main().catch((err: unknown) => {
	console.error('Analysis failed:', err);
	process.exit(1);
});
