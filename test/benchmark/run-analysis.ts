import * as path from 'path';
import * as fs from 'fs';
import * as process from 'process';
import { FlowrAnalyzerBuilder } from '../../src/project/flowr-analyzer-builder';
import { diffOfDataflowGraphs } from '../../src/dataflow/graph/diff-dataflow-graph';
import type { FlowrAnalyzer } from '../../src/project/flowr-analyzer';
import type { DataflowGraph } from '../../src/dataflow/graph/graph';
import type {
	PerformanceStats,
	OptimizationFlags,
	WorkerResult,
	LazyFunctionStats,
} from './results-types';

export interface PerformanceMetrics {
    wallMs: number;
    graph?: DataflowGraph;
}

// minimal shape for analyzers returning a graph (benchmark-only)
interface AnalyzerWithGraph {
    graph: DataflowGraph;
}

// -------------------- stats helpers --------------------
function mean(xs: number[]): number {
	return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stddev(xs: number[]): number {
	const m = mean(xs);
	return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
function sorted(xs: number[]): number[] {
	return [...xs].sort((a, b) => a - b);
}
function median(xs: number[]): number {
	const s = sorted(xs);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}
function percentile(xs: number[], p: number): number {
	const s = sorted(xs);
	const idx = Math.floor((p / 100) * (s.length - 1));
	return s[idx];
}
function stats(xs: number[]): PerformanceStats {
	return {
		mean:   mean(xs),
		median: median(xs),
		min:    Math.min(...xs),
		max:    Math.max(...xs),
		stddev: stddev(xs),
		p90:    percentile(xs, 90),
		p95:    percentile(xs, 95),
	};
}

// -------------------- analyzer builders --------------------
async function buildOptimizedAnalyzer(flags: OptimizationFlags): Promise<FlowrAnalyzer> {
	const builder = new FlowrAnalyzerBuilder();
	if(flags.lazyFunctions) {
		builder.enableDeferredFunctionEval();
	}
	// TODO: hook parallelFiles / parallelOperations
	return builder.build();
}

// -------------------- graph compare --------------------
function compareGraphs(base: DataflowGraph, opt: DataflowGraph) {
	const diff = diffOfDataflowGraphs(
		{ name: 'Baseline', graph: base },
		{ name: 'Optimized', graph: opt },
	);
	const comments = diff.comments();
	return { ok: diff.isEqual(), diffCount: comments?.length ?? 0, diff: comments };
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

// -------------------- runner --------------------
async function runOnce(
	projectPath: string,
	buildAnalyzer: () => Promise<FlowrAnalyzer>,
	captureGraph: boolean = false,
): Promise<PerformanceMetrics> {
	const analyzer = await buildAnalyzer();
	analyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });

	/** compute parsing and normailization  */
	await analyzer.normalize();


	const result = await analyzer.dataflow();

	return {
		wallMs: result['.meta'].timing,
		graph:  captureGraph ? result.graph : undefined,
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

	fs.mkdirSync(outputDir, { recursive: true });
	const fileCount = countFiles(projectPath);

	// -------------------- correctness --------------------
	let correctness: WorkerResult['correctness'] = 'skipped';

	if(!skipCorrectness) {
		console.log('Running correctness check...');

		const baseAnalyzer = (await new FlowrAnalyzerBuilder().build()) as FlowrAnalyzer & AnalyzerWithGraph;
		baseAnalyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });
		const baseDf = await baseAnalyzer.dataflow();

		const optAnalyzer = (await buildOptimizedAnalyzer(flags)) as FlowrAnalyzer & AnalyzerWithGraph;
		optAnalyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });
		const optDf = await optAnalyzer.dataflow();

		correctness = compareGraphs(baseDf.graph, optDf.graph);

		if(!correctness.ok && correctness.diff) {
			console.warn('Correctness check failed! Graphs differ:');
			correctness.diff.forEach((l) => console.error(l));
		}
	}

	// -------------------- measurement --------------------
	console.log('Measuring optimized performance...');
	const wallMsArr: number[] = [];
	let lazyStats: LazyFunctionStats | undefined;

	for(let i = 0; i < repetitions; i++) {
		const captureGraph = i === 0; // Capture graph from first run to extract lazy stats
		const run = await runOnce(projectPath, () => buildOptimizedAnalyzer(flags), captureGraph);
		wallMsArr.push(run.wallMs);

		// Collect lazy function statistics from first run (analysis is deterministic)
		if(i === 0 && run.graph) {
			const graphStats = run.graph.getLazyFunctionStatistics();
			lazyStats = {
				totalFunctionDefinitions:  graphStats.totalFunctionDefinitions,
				lazyFunctionsMaterialized: graphStats.lazyFunctionsMaterialized,
				lazyFunctionsRemaining:    graphStats.totalFunctionDefinitions - graphStats.lazyFunctionsMaterialized,
			};
		}
	}

	const wallMsStats = stats(wallMsArr);

	const result: WorkerResult = {
		project:           path.resolve(projectPath),
		threads:           undefined,
		correctness,
		fileCount,
		timestamp:         new Date().toISOString(),
		wallMs:            wallMsStats,
		lazyFunctionStats: lazyStats,
	};

	fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2), 'utf-8');
}

main().catch((err: unknown) => {
	console.error('Analysis failed:', err);
	process.exit(1);
});
