import * as path from 'path';
import * as fs from 'fs';
import * as process from 'process';
import { performance } from 'perf_hooks';
import getPhysicalCpuCount from 'physical-cpu-count';
import { FlowrAnalyzerBuilder } from '../../src/project/flowr-analyzer-builder';
import { diffOfDataflowGraphs } from '../../src/dataflow/graph/diff-dataflow-graph';
import type { FlowrAnalyzer } from '../../src/project/flowr-analyzer';
import type { DataflowGraph } from '../../src/dataflow/graph/graph';
import type {
	PerformanceStats,
	OptimizationFlags,
	WorkerResult,
	PerformanceMetricsStats,
} from './results-types';

export interface PerformanceMetrics {
    wallMs:        number;
    cpuUserMs:     number;
    cpuSystemMs:   number;
    rssMax:        number;
    heapUsedMax:   number;
    heapTotalMax:  number;
    cpuUtilApprox: number;
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
	gcBeforeRun: boolean,
): Promise<PerformanceMetrics> {
	const analyzer = await buildAnalyzer();
	analyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });

	if(gcBeforeRun) {
		(globalThis as typeof globalThis & { gc?: () => void }).gc?.();
	}


	const memSamples: NodeJS.MemoryUsage[] = [process.memoryUsage()];
	const sampleInterval = setInterval(() => memSamples.push(process.memoryUsage()), 10);

	const cpuStart = process.cpuUsage();
	const t0 = performance.now();

	const _result = await analyzer.dataflow(); // intentionally unused in benchmarks

	const t1 = performance.now();
	const cpuEnd = process.cpuUsage(cpuStart);

	clearInterval(sampleInterval);

	const rssMax = Math.max(...memSamples.map((m) => m.rss));
	const heapUsedMax = Math.max(...memSamples.map((m) => m.heapUsed));
	const heapTotalMax = Math.max(...memSamples.map((m) => m.heapTotal));
	const wallMs = t1 - t0;
	const cpuUserMs = cpuEnd.user / 1000;
	const cpuSystemMs = cpuEnd.system / 1000;
	const cpuUtilApprox =
        wallMs > 0 ? (cpuUserMs + cpuSystemMs) / wallMs / getPhysicalCpuCount : 0;

	return { wallMs, cpuUserMs, cpuSystemMs, rssMax, heapUsedMax, heapTotalMax, cpuUtilApprox };
}

// -------------------- main --------------------
async function main(): Promise<void> {
	const projectPath = process.argv[2];
	const outputDir = process.argv[3];
	const repetitions = Number(process.argv[4] ?? '5');

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
	const warmup = process.argv.includes('--warmup');
	const gcBeforeRun = process.argv.includes('--gcBeforeRun');

	fs.mkdirSync(outputDir, { recursive: true });
	const physicalCores = getPhysicalCpuCount;
	const fileCount = countFiles(projectPath);

	// -------------------- correctness --------------------
	let correctness: WorkerResult['correctness'] = 'skipped';
	if(!skipCorrectness) {
		console.log('Running correctness check...');

		const baseAnalyzer = (await new FlowrAnalyzerBuilder().build()) as FlowrAnalyzer & AnalyzerWithGraph;
		baseAnalyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });
		await baseAnalyzer.dataflow();

		const optAnalyzer = (await buildOptimizedAnalyzer(flags)) as FlowrAnalyzer & AnalyzerWithGraph;
		optAnalyzer.addRequest({ request: 'project', content: path.resolve(projectPath) });
		await optAnalyzer.dataflow();

		correctness = compareGraphs(baseAnalyzer.graph, optAnalyzer.graph);

		if(!correctness.ok && correctness.diff) {
			console.warn('Correctness check failed! Graphs differ:');
			correctness.diff.forEach((l) => console.error(l));
		}
	}

	// -------------------- warmup --------------------
	if(warmup) {
		await runOnce(projectPath, () => buildOptimizedAnalyzer(flags), gcBeforeRun);
	}

	// -------------------- measurement --------------------
	console.log('Measuring optimized performance...');
	const wallMsArr: number[] = [];
	const cpuUserArr: number[] = [];
	const cpuSystemArr: number[] = [];
	const rssArr: number[] = [];
	const heapUsedArr: number[] = [];
	const heapTotalArr: number[] = [];
	const cpuUtilArr: number[] = [];

	for(let i = 0; i < repetitions; i++) {
		const run = await runOnce(projectPath, () => buildOptimizedAnalyzer(flags), gcBeforeRun);
		wallMsArr.push(run.wallMs);
		cpuUserArr.push(run.cpuUserMs);
		cpuSystemArr.push(run.cpuSystemMs);
		rssArr.push(run.rssMax);
		heapUsedArr.push(run.heapUsedMax);
		heapTotalArr.push(run.heapTotalMax);
		cpuUtilArr.push(run.cpuUtilApprox);
	}

	const optimizedMetrics: PerformanceMetricsStats = {
		wallMs:        stats(wallMsArr),
		cpuUserMs:     stats(cpuUserArr),
		cpuSystemMs:   stats(cpuSystemArr),
		rssMax:        stats(rssArr),
		heapUsedMax:   stats(heapUsedArr),
		heapTotalMax:  stats(heapTotalArr),
		cpuUtilApprox: stats(cpuUtilArr),
	};

	const result: WorkerResult = {
		project:       path.resolve(projectPath),
		repetitions,
		threads:       undefined,
		optimizations: flags,
		correctness,
		physicalCores,
		noStats:       false,
		warmup,
		gcBeforeRun,
		fileCount,
		timestamp:     new Date().toISOString(),
		stats:         optimizedMetrics,
	};

	fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2), 'utf-8');
}

main().catch((err: unknown) => {
	console.error('Analysis failed:', err);
	process.exit(1);
});
