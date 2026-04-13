import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type {
	AnalysisRunResult,
	BenchmarkResult,
	CorrectnessOutcome,
	CorrectnessStats,
	CorrectnessStatsByThreads,
	LazyFunctionStats,
	ProjectResult,
} from './results-types';
import { CorrectnessClassification, correctnessClassificationToName } from './results-types';

type Settings = {
    suitePaths:           string[];
    workerJs:             string;
    resultsRoot:          string;
    runName:              string;
    maxProjectsPerSuite?: number;

    repetitions:      number;
    skipCorrectness?: boolean;
    dryRun?:          boolean;

    optimizations?: {
        parallelFiles?:      boolean;
        parallelOperations?: boolean;
        lazyFunctions?:      boolean;
    };

    // Arrays of threads for worker execution
    threadsForCorrectness?: number[];
    threadsForPerformance?: number[];
};

type BenchmarkRuntime = {
	settingsPath: string;
	settings:     Settings;
	suitePaths:   string[];
	workerJs:     string;
	resultRoot:   string;
	outputRoot:   string;
	dryRun:       boolean;
};

type ThreadRunResult = {
	threadKey:              string;
	project:                string;
	fileCount:              number;
	wallMs:                 number[];
	correctness:            CorrectnessOutcome;
	lazyFunctionStats?:     LazyFunctionStats;
	sequentialReanalysis?:  boolean;
	graphMetrics?:          ProjectResult['graphMetrics'];
	sourceCharacteristics?: ProjectResult['sourceCharacteristics'];
	timestamp:              string;
};

const tempResultRelativePath = './.tmp-analysis-result.json';

function appendOptimizationArgs(args: string[], runtime: BenchmarkRuntime): void {
	if(runtime.settings.optimizations?.parallelFiles) {
		args.push('--parallelFiles');
	}
	if(runtime.settings.optimizations?.parallelOperations) {
		args.push('--parallelOperations');
	}
	if(runtime.settings.optimizations?.lazyFunctions) {
		args.push('--lazyFunctions');
	}
}

function buildAnalysisArgs(
	runtime: BenchmarkRuntime,
	projectDir: string,
	profileDir: string,
	tempResultPath: string,
	threads: number | undefined,
	flags: { skipCorrectness: boolean; runtimeOnly: boolean; dryRun: boolean },
): string[] {
	const args = [
		runtime.workerJs,
		projectDir,
		profileDir,
		'--tempResultPath',
		tempResultPath,
	];

	if(threads !== undefined) {
		args.push('--threads', String(threads));
	}

	if(flags.skipCorrectness) {
		args.push('--skipCorrectness');
	}
	if(flags.runtimeOnly) {
		args.push('--runtimeOnly');
	}
	if(flags.dryRun) {
		args.push('--dryRun');
	}

	appendOptimizationArgs(args, runtime);
	return args;
}

async function runAnalysisProcess(args: string[], errorMessage: string): Promise<void> {
	const child = spawn('node', args, { stdio: 'inherit' });
	const exitCode: number | null = await new Promise(resolve => child.on('close', code => resolve(code)));
	if(exitCode !== 0) {
		throw new Error(`${errorMessage} (exit=${exitCode})`);
	}
}

function buildProjectResult(results: readonly ThreadRunResult[]): ProjectResult {
	const [first] = results;
	const projectResult: ProjectResult = {
		project:              first.project,
		fileCount:            first.fileCount,
		timestamp:            new Date().toISOString(),
		wallMsByThreads:      {},
		correctnessByThreads: {},
	};

	for(const result of results) {
		if(result.fileCount !== first.fileCount) {
			throw new Error(`Inconsistent file count for ${first.project}: expected ${first.fileCount}, got ${result.fileCount}`);
		}
		projectResult.wallMsByThreads[result.threadKey] = result.wallMs;
		projectResult.correctnessByThreads[result.threadKey] = result.correctness;
		projectResult.lazyFunctionStats ??= result.lazyFunctionStats;
		projectResult.sequentialReanalysis ??= result.sequentialReanalysis;
		projectResult.graphMetrics ??= result.graphMetrics;
		projectResult.sourceCharacteristics ??= result.sourceCharacteristics;
	}

	return projectResult;
}

function addLazyStats(acc: LazyFunctionStats | undefined, stats: LazyFunctionStats | undefined): LazyFunctionStats | undefined {
	if(!stats) {
		return acc;
	}
	if(!acc) {
		return { ...stats };
	}
	acc.totalFunctionDefinitions += stats.totalFunctionDefinitions;
	acc.lazyFunctionsMaterialized += stats.lazyFunctionsMaterialized;
	acc.lazyFunctionsRemaining += stats.lazyFunctionsRemaining;
	return acc;
}

function addGraphMetrics(acc: ProjectResult['graphMetrics'] | undefined, stats: ProjectResult['graphMetrics'] | undefined): ProjectResult['graphMetrics'] | undefined {
	if(!stats) {
		return acc;
	}
	if(!acc) {
		const seeded = { ...stats, nodeTypeDistribution: { ...stats.nodeTypeDistribution } };
		return seeded;
	}
	acc.nodeCount += stats.nodeCount;
	acc.sideEffectCount += stats.sideEffectCount;
	for(const [type, count] of Object.entries(stats.nodeTypeDistribution)) {
		acc.nodeTypeDistribution[type] = (acc.nodeTypeDistribution[type] ?? 0) + count;
	}
	return acc;
}

function addSourceStats(acc: ProjectResult['sourceCharacteristics'] | undefined, stats: ProjectResult['sourceCharacteristics'] | undefined): ProjectResult['sourceCharacteristics'] | undefined {
	if(!stats) {
		return acc;
	}
	if(!acc) {
		const seeded = { ...stats };
		return seeded;
	}
	acc.lineCount += stats.lineCount;
	acc.totalBytes += stats.totalBytes;
	acc.fileCount += stats.fileCount;
	return acc;
}

// --------------------------------------------------
// Load settings
// --------------------------------------------------
function loadBenchmarkRuntime(args: readonly string[]): BenchmarkRuntime {
	const thisDir = __dirname;
	let settingsPath = path.join(thisDir, 'settings.json');

	const profileIndex = args.indexOf('--profile');
	if(profileIndex >= 0 && args.length > profileIndex + 1) {
		settingsPath = path.resolve(thisDir, args[profileIndex + 1]);
	}

	if(!fs.existsSync(settingsPath)) {
		throw new Error(`Missing settings file at ${settingsPath}`);
	}

	const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Settings;
	const settingsDir = path.dirname(settingsPath);
	const suitePaths = settings.suitePaths.map(p => path.resolve(settingsDir, p));
	const workerJs = path.resolve(settingsDir, settings.workerJs);
	const resultRoot = path.resolve(settingsDir, settings.resultsRoot);
	const outputRoot = path.join(resultRoot, settings.runName);
	const dryRun = settings.dryRun === true || args.includes('--dryRun');

	return {
		settingsPath,
		settings,
		suitePaths,
		workerJs,
		resultRoot,
		outputRoot,
		dryRun,
	};
}


// ---------------- Discovery ----------------

function listSuites(suitePaths: readonly string[]): { name: string; path: string }[] {
	if(suitePaths.length === 0) {
		throw new Error('No suite paths configured. Please provide at least one entry in "suitePaths".');
	}

	const seenNames = new Set<string>();
	return suitePaths.map((suitePath, index) => {
		if(!fs.existsSync(suitePath)) {
			throw new Error(`Suite path does not exist: ${suitePath}`);
		}
		if(!fs.statSync(suitePath).isDirectory()) {
			throw new Error(`Suite path is not a directory: ${suitePath}`);
		}

		const baseName = path.basename(suitePath);
		let suiteName = baseName;
		if(seenNames.has(suiteName)) {
			suiteName = `${baseName}-${index + 1}`;
		}
		seenNames.add(suiteName);

		return { name: suiteName, path: suitePath };
	});
}

function listProjectsInSuite(suitePath: string, maxProjectsPerSuite?: number): string[] {
	let projects = fs.readdirSync(suitePath, { withFileTypes: true })
		.filter(e => e.isDirectory())
		.map(e => path.join(suitePath, e.name));

	if(maxProjectsPerSuite && projects.length > maxProjectsPerSuite) {
		console.log(`Limiting projects in suite ${path.basename(suitePath)} to ${maxProjectsPerSuite} (was ${projects.length})`);
		projects = projects.slice(0, maxProjectsPerSuite);
	}
	return projects;
}

// ---------------- Runner ----------------

async function runOne(runtime: BenchmarkRuntime, suite: string, projectDir: string, threads?: number, skipCorrectness?: boolean): Promise<ThreadRunResult | undefined> {
	const projectName = path.basename(projectDir);
	const profileDir = path.join(runtime.outputRoot, suite, projectName);
	if(!runtime.dryRun) {
		fs.mkdirSync(profileDir, { recursive: true });
	}

	if(runtime.dryRun) {
		console.log(`\n=== Dry Run: [${suite}] ${projectName}${threads ? ` | threads=${threads}` : ''} ===`);
		console.log(`[dry-run] would execute project: ${projectDir}`);
	} else {
		console.log(`\n=== Running: [${suite}] ${projectName}${threads ? ` | threads=${threads}` : ''} ===`);
	}

	if(runtime.dryRun) {
		const tempResultPath = path.resolve(profileDir, tempResultRelativePath);
		const dryRunArgs = buildAnalysisArgs(runtime, projectDir, profileDir, tempResultPath, threads, {
			skipCorrectness: skipCorrectness || (runtime.settings.skipCorrectness ?? false),
			runtimeOnly:     false,
			dryRun:          true,
		});
		await runAnalysisProcess(dryRunArgs, `Run failed for [${suite}] ${projectName}`);
		return undefined;
	}

	const tempResultPath = path.resolve(profileDir, tempResultRelativePath);
	const threadKey = String(threads ?? 1);
	if(fs.existsSync(tempResultPath)) {
		fs.rmSync(tempResultPath, { force: true });
	}

	const wallMs: number[] = [];
	let lazyFunctionStats: LazyFunctionStats | undefined;
	let sequentialReanalysis: boolean | undefined;
	let graphMetrics: ProjectResult['graphMetrics'] | undefined;
	let sourceCharacteristics: ProjectResult['sourceCharacteristics'] | undefined;
	let fileCount: number | undefined;
	let correctness: CorrectnessOutcome = 'skipped';

	for(let iteration = 0; iteration < runtime.settings.repetitions; iteration++) {
		const runtimeOnly = iteration > 0;
		const shouldSkipCorrectness = runtimeOnly || skipCorrectness || (runtime.settings.skipCorrectness ?? false);
		const args = buildAnalysisArgs(runtime, projectDir, profileDir, tempResultPath, threads, {
			skipCorrectness: shouldSkipCorrectness,
			runtimeOnly,
			dryRun:          false,
		});
		await runAnalysisProcess(args, `Run failed for [${suite}] ${projectName} (iteration ${iteration + 1})`);

		if(!fs.existsSync(tempResultPath)) {
			throw new Error(`Missing temporary analysis result at ${tempResultPath}`);
		}

		const iterationResult: AnalysisRunResult = JSON.parse(fs.readFileSync(tempResultPath, 'utf-8')) as AnalysisRunResult;
		wallMs.push(iterationResult.wallMs);
		if(fileCount === undefined) {
			fileCount = iterationResult.fileCount;
		} else if(fileCount !== iterationResult.fileCount) {
			throw new Error(`Inconsistent file count for ${projectDir}: expected ${fileCount}, got ${iterationResult.fileCount}`);
		}
		if(!shouldSkipCorrectness){
			correctness = iterationResult.correctness;
		}
		lazyFunctionStats ??= iterationResult.lazyFunctionStats;
		sequentialReanalysis ??= iterationResult.sequentialReanalysis;
		graphMetrics ??= iterationResult.graphMetrics;
		sourceCharacteristics ??= iterationResult.sourceCharacteristics;
	}

	if(wallMs.length === 0) {
		throw new Error(`No iteration result collected for [${suite}] ${projectName}`);
	}
	if(fileCount === undefined) {
		throw new Error(`Missing file count for [${suite}] ${projectName}`);
	}

	if(fs.existsSync(tempResultPath)) {
		fs.rmSync(tempResultPath, { force: true });
	}

	return {
		threadKey,
		project:   projectDir,
		fileCount,
		wallMs,
		correctness,
		lazyFunctionStats,
		sequentialReanalysis,
		graphMetrics,
		sourceCharacteristics,
		timestamp: new Date().toISOString(),
	};
}

async function runProjectForThreads(runtime: BenchmarkRuntime, suite: string, projectPath: string): Promise<void> {
	const projectName = path.basename(projectPath);
	const profileDir = path.join(runtime.outputRoot, suite, projectName);
	const finalResultPath = path.join(profileDir, 'result.json');
	const correctnessThreads = runtime.settings.threadsForCorrectness ?? [];
	const performanceThreads = runtime.settings.threadsForPerformance ?? [];
	const threadCounts = runtime.settings.optimizations?.parallelFiles && performanceThreads.length > 0 ? performanceThreads : [1];
	const threadResults: ThreadRunResult[] = [];

	for(const threads of threadCounts) {
		const skipCorrectness = runtime.settings.optimizations?.parallelFiles ? !correctnessThreads.includes(threads) : (runtime.settings.skipCorrectness ?? false);
		const result = await runOne(runtime, suite, projectPath, threads, skipCorrectness);
		if(result) {
			threadResults.push(result);
		}
	}

	if(threadResults.length > 0) {
		fs.mkdirSync(profileDir, { recursive: true });
		fs.writeFileSync(finalResultPath, JSON.stringify(buildProjectResult(threadResults), null, 2), 'utf-8');
	}
}


async function runTestSuite(runtime: BenchmarkRuntime, suiteName: string, suitePath: string): Promise<void> {
	console.log(`\n=== Suite: ${suiteName} ===`);
	const projects = listProjectsInSuite(suitePath, runtime.settings.maxProjectsPerSuite);
	console.log(`Found ${projects.length} projects in suite ${suiteName}`);

	for(const projectPath of projects) {
		await runProjectForThreads(runtime, suiteName, projectPath);
	}
}

// ---------------- Results ----------------

function mean(xs: readonly number[]): number {
	if(xs.length === 0) {
		return 0;
	}
	return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function emptyCorrectnessStats(): CorrectnessStats {
	return { correct: 0, imprecise: 0, incorrect: 0, skipped: 0 };
}

function addCorrectness(stats: CorrectnessStats, correctness: CorrectnessOutcome): void {
	if(correctness === 'skipped') {
		stats.skipped++;
		return;
	}
	switch(correctness.classification) {
		case CorrectnessClassification.Correct:
			stats.correct++;
			return;
		case CorrectnessClassification.Imprecise:
			stats.imprecise++;
			return;
		case CorrectnessClassification.Incorrect:
			stats.incorrect++;
			return;
	}
}

function collectResults(outputRoot: string): BenchmarkResult {
	if(!fs.existsSync(outputRoot)) {
		throw new Error(`Output directory does not exist: ${outputRoot}`);
	}
	const suiteDirs = fs.readdirSync(outputRoot, { withFileTypes: true })
		.filter(e => e.isDirectory())
		.map(e => path.join(outputRoot, e.name));

	const suites: BenchmarkResult = [];


	for(const suiteDir of suiteDirs) {
		let totalFiles = 0;
		const suiteName = path.basename(suiteDir);
		const projectDirs = fs.readdirSync(suiteDir, { withFileTypes: true })
			.filter(e => e.isDirectory())
			.map(e => path.join(suiteDir, e.name));

		const projects: ProjectResult[] = [];
		const totalRuntimes: number[] = [];

		// Aggregate lazy function stats
		let totalLazyFunctionStats: LazyFunctionStats | undefined;

		// Aggregate graph metrics
		let aggregateGraphMetrics: ProjectResult['graphMetrics'] | undefined;

		// Aggregate source stats
		let aggregateSourceStats: ProjectResult['sourceCharacteristics'] | undefined;
		const correctnessStatsByThreads: CorrectnessStatsByThreads = {};

		for(const projectDir of projectDirs) {
			const _projectName = path.basename(projectDir);
			const resultPath = path.join(projectDir, 'result.json');
			if(!fs.existsSync(resultPath)) {
				console.warn(`Missing result.json in ${projectDir}, skipping`);
				continue;
			}

			const data: ProjectResult = JSON.parse(fs.readFileSync(resultPath, 'utf-8')) as ProjectResult;
			totalFiles += data.fileCount;
			projects.push(data);

			// Use measured runtime datapoints and aggregate by per-project/thread mean runtime.
			for(const runtimes of Object.values(data.wallMsByThreads)) {
				if(runtimes.length > 0) {
					totalRuntimes.push(mean(runtimes));
				}
			}

			for(const [threadKey, correctness] of Object.entries(data.correctnessByThreads)) {
				correctnessStatsByThreads[threadKey] ??= emptyCorrectnessStats();
				addCorrectness(correctnessStatsByThreads[threadKey], correctness);
			}

			// Aggregate lazy function stats
			totalLazyFunctionStats = addLazyStats(totalLazyFunctionStats, data.lazyFunctionStats);

			// Aggregate graph metrics
			aggregateGraphMetrics = addGraphMetrics(aggregateGraphMetrics, data.graphMetrics);

			// Aggregate source stats
			aggregateSourceStats = addSourceStats(aggregateSourceStats, data.sourceCharacteristics);
		}

		const totalRuntimeMs = totalRuntimes.reduce((a, b) => a + b, 0);
		const meanProjectRuntimeMs = totalRuntimes.length ? totalRuntimeMs / totalRuntimes.length : 0;

		console.log(`\nSuite ${suiteName}:`);
		console.log(`- Projects: ${projects.length}`);
		console.log(`- Total runtime: ${(totalRuntimeMs).toFixed(6)} ms`);
		console.log(`- Mean per project-thread: ${(meanProjectRuntimeMs).toFixed(6)} ms`);
		console.log(`- Total files analyzed: ${totalFiles}`);
		if(Object.keys(correctnessStatsByThreads).length > 0) {
			for(const [threadKey, stats] of Object.entries(correctnessStatsByThreads).sort((a, b) => Number(a[0]) - Number(b[0]))) {
				console.log(
					`  threads=${threadKey}: ${stats.correct} ${correctnessClassificationToName(CorrectnessClassification.Correct)}, ` +
					`${stats.imprecise} ${correctnessClassificationToName(CorrectnessClassification.Imprecise)}, ` +
					`${stats.incorrect} ${correctnessClassificationToName(CorrectnessClassification.Incorrect)}, ` +
					`${stats.skipped} skipped`
				);
			}
		}
		if(totalLazyFunctionStats) {
			console.log(`- Total function definitions: ${totalLazyFunctionStats.totalFunctionDefinitions}`);
			console.log(`- Functions materialized: ${totalLazyFunctionStats.lazyFunctionsMaterialized}`);
			console.log(`- Functions remaining lazy: ${totalLazyFunctionStats.lazyFunctionsRemaining}`);
		}
		if(aggregateGraphMetrics) {
			console.log(`- Graph nodes: ${aggregateGraphMetrics.nodeCount}, side effects: ${aggregateGraphMetrics.sideEffectCount}`);
		}
		if(aggregateSourceStats) {
			console.log(`- Source: ${aggregateSourceStats.lineCount} lines, ${(aggregateSourceStats.totalBytes / 1024 / 1024).toFixed(2)} MB, ${aggregateSourceStats.fileCount} files`);
		}

		suites.push({
			suiteName,
			projects,
			totalRuntimeMs,
			meanProjectRuntimeMs,
			totalFiles,
			totalLazyFunctionStats,
			correctnessStatsByThreads: Object.keys(correctnessStatsByThreads).length > 0 ? correctnessStatsByThreads : undefined,
			aggregateGraphMetrics,
			aggregateSourceStats,
		});
	}
	return suites;
}

function writeSummary(suites: BenchmarkResult, outputRoot: string) {
	fs.mkdirSync(outputRoot, { recursive: true });
	const summaryPath = path.join(outputRoot, 'summary.json');
	fs.writeFileSync(summaryPath, JSON.stringify(suites, null, 2), 'utf-8');

	const totalProjects = suites.reduce((sum, s) => sum + s.projects.length, 0);
	const totalRuntime = suites.reduce((sum, s) => sum + s.totalRuntimeMs, 0);
	const totalFiles = suites.reduce((sum, s) => sum + s.totalFiles, 0);

	// Aggregate lazy function stats across all suites
	let totalLazyStats: LazyFunctionStats | undefined;
	for(const suite of suites) {
		totalLazyStats = addLazyStats(totalLazyStats, suite.totalLazyFunctionStats);
	}

	// Aggregate correctness stats across all suites (per-thread only)
	const totalCorrectnessStatsByThreads: CorrectnessStatsByThreads = {};
	for(const suite of suites) {
		if(suite.correctnessStatsByThreads) {
			for(const [threadKey, stats] of Object.entries(suite.correctnessStatsByThreads)) {
				totalCorrectnessStatsByThreads[threadKey] ??= emptyCorrectnessStats();
				totalCorrectnessStatsByThreads[threadKey].correct += stats.correct;
				totalCorrectnessStatsByThreads[threadKey].imprecise += stats.imprecise;
				totalCorrectnessStatsByThreads[threadKey].incorrect += stats.incorrect;
				totalCorrectnessStatsByThreads[threadKey].skipped += stats.skipped;
			}
		}
	}

	// Aggregate graph metrics across all suites
	let totalGraphMetrics: ProjectResult['graphMetrics'] | undefined;
	for(const suite of suites) {
		totalGraphMetrics = addGraphMetrics(totalGraphMetrics, suite.aggregateGraphMetrics);
	}

	// Aggregate source stats across all suites
	let totalSourceStats: ProjectResult['sourceCharacteristics'] | undefined;
	for(const suite of suites) {
		totalSourceStats = addSourceStats(totalSourceStats, suite.aggregateSourceStats);
	}

	console.log('\n=== Summary written ===');
	console.log(`- ${summaryPath}`);
	console.log(`Total suites: ${suites.length}`);
	console.log(`Total projects: ${totalProjects}`);
	console.log(`Total runtime across all suites: ${(totalRuntime / 1000).toFixed(2)} s`);
	console.log(`Total files analyzed: ${totalFiles}`);
	if(Object.keys(totalCorrectnessStatsByThreads).length > 0) {
		console.log('\n=== Correctness Statistics ===');
		for(const [threadKey, stats] of Object.entries(totalCorrectnessStatsByThreads).sort((a, b) => Number(a[0]) - Number(b[0]))) {
			console.log(
				`threads=${threadKey}: ${stats.correct} ${correctnessClassificationToName(CorrectnessClassification.Correct)}, ` +
				`${stats.imprecise} ${correctnessClassificationToName(CorrectnessClassification.Imprecise)}, ` +
				`${stats.incorrect} ${correctnessClassificationToName(CorrectnessClassification.Incorrect)}, ` +
				`${stats.skipped} skipped`
			);
		}
	}
	if(totalLazyStats) {
		console.log('\n=== Lazy Function Statistics ===');
		console.log(`Total function definitions: ${totalLazyStats.totalFunctionDefinitions}`);
		console.log(`Total functions materialized: ${totalLazyStats.lazyFunctionsMaterialized}`);
		console.log(`Total functions remaining lazy: ${totalLazyStats.lazyFunctionsRemaining}`);
		if(totalLazyStats.totalFunctionDefinitions > 0) {
			const materializationRate = ((totalLazyStats.lazyFunctionsMaterialized / totalLazyStats.totalFunctionDefinitions) * 100).toFixed(2);
			console.log(`Materialization rate: ${materializationRate}%`);
		}
	}
	if(totalGraphMetrics) {
		console.log('\n=== Graph Metrics ===');
		console.log(`Total nodes: ${totalGraphMetrics.nodeCount}`);
		console.log(`Total side effects: ${totalGraphMetrics.sideEffectCount}`);
		console.log('Node type distribution:');
		for(const [type, count] of Object.entries(totalGraphMetrics.nodeTypeDistribution).sort((a, b) => b[1] - a[1])) {
			console.log(`  ${type}: ${count}`);
		}
	}
	if(totalSourceStats) {
		console.log('\n=== Source Code Statistics ===');
		console.log(`Total lines of code: ${totalSourceStats.lineCount}`);
		console.log(`Total source size: ${(totalSourceStats.totalBytes / 1024 / 1024).toFixed(2)} MB`);
		console.log(`Total files: ${totalSourceStats.fileCount}`);
	}

}

// ---------------- Main ----------------

async function main() {
	const runtime = loadBenchmarkRuntime(process.argv);

	console.log('=== Benchmark settings loaded ===');
	console.log(`Settings file: ${runtime.settingsPath}`);
	console.log(`Run name: ${runtime.settings.runName}`);
	console.log(`Suite paths (${runtime.suitePaths.length}):`);
	for(const suitePath of runtime.suitePaths) {
		console.log(`- ${suitePath}`);
	}
	console.log(`Worker JS: ${runtime.workerJs}`);
	console.log(`Results root: ${runtime.resultRoot}`);

	console.log('=== Benchmark settings ===');
	console.log(`Suite paths configured: ${runtime.suitePaths.length}`);
	console.log(`Worker JS:    ${runtime.workerJs}`);
	console.log(`Output dir:   ${runtime.outputRoot}`);
	console.log(`Max projects per suite: ${runtime.settings.maxProjectsPerSuite ?? 'all'}`);
	console.log(`Repetitions: ${runtime.settings.repetitions}`);
	console.log(`Skip correctness: ${runtime.settings.skipCorrectness ?? false}`);
	console.log(`Dry run: ${runtime.dryRun}`);
	console.log(`Optimizations: ${JSON.stringify(runtime.settings.optimizations ?? {}, null, 2)}`);
	console.log('Threads (correctness): ', runtime.settings.threadsForCorrectness);
	console.log('Threads (performance): ', runtime.settings.threadsForPerformance);

	if(!runtime.dryRun) {
		if(fs.existsSync(runtime.outputRoot)) {
			console.log(`Cleaning existing benchmark output: ${runtime.outputRoot}`);
			fs.rmSync(runtime.outputRoot, { recursive: true, force: true });
		}
		fs.mkdirSync(runtime.outputRoot, { recursive: true });
	}

	const suites = listSuites(runtime.suitePaths);
	console.log(`\nConfigured ${suites.length} suites.`);

	for(const suite of suites) {
		await runTestSuite(runtime, suite.name, suite.path);
	}

	if(runtime.dryRun) {
		console.log('\nDry run complete. No analyses were executed and no result files were written.');
		return;
	}

	const results = collectResults(runtime.outputRoot);
	writeSummary(results, runtime.outputRoot);
}

main().catch(err => {
	console.error('Benchmark failed:', err);
	process.exit(1);
});
