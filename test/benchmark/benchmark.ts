import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { WorkerResult } from './results-types';
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

const tempResultRelativePath = './.tmp-analysis-result.json';

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

async function runOne(runtime: BenchmarkRuntime, suite: string, projectDir: string, threads?: number, skipCorrectness?: boolean): Promise<void> {
	const projectName = path.basename(projectDir);
	let profileDir = path.join(runtime.outputRoot, suite, projectName);
	if(threads) {
		profileDir += `-threads-${threads}`;
	}
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
		const dryRunArgs: string[] = [
			runtime.workerJs,
			projectDir,
			profileDir,
			'--tempResultPath',
			tempResultPath,
		];

		if(skipCorrectness || (runtime.settings.skipCorrectness ?? false)) {
			dryRunArgs.push('--skipCorrectness');
		}
		if(runtime.settings.optimizations?.parallelFiles) {
			dryRunArgs.push('--parallelFiles');
		}
		if(runtime.settings.optimizations?.parallelOperations) {
			dryRunArgs.push('--parallelOperations');
		}
		if(runtime.settings.optimizations?.lazyFunctions) {
			dryRunArgs.push('--lazyFunctions');
		}
		dryRunArgs.push('--dryRun');

		const child = spawn(
			'node',
			dryRunArgs,
			{ stdio: 'inherit' }
		);

		const exitCode: number | null = await new Promise(resolve => child.on('close', code => resolve(code)));
		if(exitCode !== 0) {
			throw new Error(`Run failed for [${suite}] ${projectName} (exit=${exitCode})`);
		}
		return;
	}

	const tempResultPath = path.resolve(profileDir, tempResultRelativePath);
	if(fs.existsSync(tempResultPath)) {
		fs.rmSync(tempResultPath, { force: true });
	}

	let aggregatedResult: WorkerResult | undefined;

	for(let iteration = 0; iteration < runtime.settings.repetitions; iteration++) {
		const runtimeOnly = iteration > 0;
		const shouldSkipCorrectness = runtimeOnly || skipCorrectness || (runtime.settings.skipCorrectness ?? false);
		const args: string[] = [
			runtime.workerJs,
			projectDir,
			profileDir,
			'--tempResultPath',
			tempResultPath,
		];

		if(shouldSkipCorrectness) {
			args.push('--skipCorrectness');
		}
		if(runtimeOnly) {
			args.push('--runtimeOnly');
		}
		if(runtime.settings.optimizations?.parallelFiles) {
			args.push('--parallelFiles');
		}
		if(runtime.settings.optimizations?.parallelOperations) {
			args.push('--parallelOperations');
		}
		if(runtime.settings.optimizations?.lazyFunctions) {
			args.push('--lazyFunctions');
		}

		const child = spawn(
			'node',
			args,
			{ stdio: 'inherit' }
		);

		const exitCode: number | null = await new Promise(resolve => child.on('close', code => resolve(code)));
		if(exitCode !== 0) {
			throw new Error(`Run failed for [${suite}] ${projectName} (iteration ${iteration + 1}, exit=${exitCode})`);
		}

		if(!fs.existsSync(tempResultPath)) {
			throw new Error(`Missing temporary analysis result at ${tempResultPath}`);
		}

		const iterationResult: WorkerResult = JSON.parse(fs.readFileSync(tempResultPath, 'utf-8')) as WorkerResult;
		if(!aggregatedResult) {
			aggregatedResult = {
				...iterationResult,
				threads,
				wallMs: [...iterationResult.wallMs],
			};
		} else {
			aggregatedResult.wallMs.push(...iterationResult.wallMs);
		}
	}

	if(!aggregatedResult) {
		throw new Error(`No iteration result collected for [${suite}] ${projectName}`);
	}

	aggregatedResult.timestamp = new Date().toISOString();
	const finalResultPath = path.join(profileDir, 'result.json');
	fs.writeFileSync(finalResultPath, JSON.stringify(aggregatedResult, null, 2), 'utf-8');
	if(fs.existsSync(tempResultPath)) {
		fs.rmSync(tempResultPath, { force: true });
	}
}

async function runProjectForThreads(runtime: BenchmarkRuntime, suite: string, projectPath: string): Promise<void> {
	if(!runtime.settings.optimizations?.parallelFiles) {
		// Thread-specific settings only matter for file-parallel runs.
		await runOne(runtime, suite, projectPath);
		return;
	}

	const correctnessThreads = runtime.settings.threadsForCorrectness ?? [];
	const performanceThreads = runtime.settings.threadsForPerformance ?? [];
	if(performanceThreads.length === 0) {
		console.warn('File parallelization is enabled, but no performance thread counts are configured. Running a single default analysis.');
		await runOne(runtime, suite, projectPath);
		return;
	}


	for(const threads of performanceThreads) {
		const skipCorrectness = !correctnessThreads.includes(threads);
		await runOne(runtime, suite, projectPath, threads, skipCorrectness);
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

type SuiteSummary = {
    suiteName:               string;
    projects:                WorkerResult[];
    totalRuntimeMs:          number;
    meanProjectRuntimeMs:    number;
    totalFiles:              number;
    totalLazyFunctionStats?:  {
		totalFunctionDefinitions:  number;
		lazyFunctionsMaterialized: number;
		lazyFunctionsRemaining:    number;
	};
    correctnessStats?: {
		correct:   number;
		imprecise: number;
		incorrect: number;
		skipped:   number;
	};
    aggregateGraphMetrics?: {
		totalNodes:           number;
		totalSideEffects:     number;
		nodeTypeDistribution: Record<string, number>;
	};
    aggregateSourceStats?: {
		totalLineCount: number;
		totalBytes:     number;
		totalFileCount: number;
	};
};

function mean(xs: readonly number[]): number {
	if(xs.length === 0) {
		return 0;
	}
	return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function collectResults(outputRoot: string): SuiteSummary[] {
	if(!fs.existsSync(outputRoot)) {
		throw new Error(`Output directory does not exist: ${outputRoot}`);
	}
	const suiteDirs = fs.readdirSync(outputRoot, { withFileTypes: true })
		.filter(e => e.isDirectory())
		.map(e => path.join(outputRoot, e.name));

	const suites: SuiteSummary[] = [];


	for(const suiteDir of suiteDirs) {
		let totalFiles = 0;
		const suiteName = path.basename(suiteDir);
		const projectDirs = fs.readdirSync(suiteDir, { withFileTypes: true })
			.filter(e => e.isDirectory())
			.map(e => path.join(suiteDir, e.name));

		const projects: WorkerResult[] = [];
		const totalRuntimes: number[] = [];

		// Aggregate lazy function stats
		let totalLazyFunctionStats: { totalFunctionDefinitions: number; lazyFunctionsMaterialized: number; lazyFunctionsRemaining: number } | undefined;

		// Aggregate graph metrics
		let aggregateGraphMetrics: { totalNodes: number; totalSideEffects: number; nodeTypeDistribution: Record<string, number> } | undefined;

		// Aggregate source stats
		let aggregateSourceStats: { totalLineCount: number; totalBytes: number; totalFileCount: number } | undefined;

		for(const projectDir of projectDirs) {
			const _projectName = path.basename(projectDir);
			const resultPath = path.join(projectDir, 'result.json');
			if(!fs.existsSync(resultPath)) {
				console.warn(`Missing result.json in ${projectDir}, skipping`);
				continue;
			}

			const data: WorkerResult = JSON.parse(fs.readFileSync(resultPath, 'utf-8')) as WorkerResult;
			totalFiles += data.fileCount;
			projects.push(data);

			// Use measured runtime datapoints and aggregate by per-project mean runtime.
			if(data.wallMs.length > 0) {
				totalRuntimes.push(mean(data.wallMs));
			}

			// Aggregate lazy function stats
			if(data.lazyFunctionStats) {
				if(!totalLazyFunctionStats) {
					totalLazyFunctionStats = { totalFunctionDefinitions: 0, lazyFunctionsMaterialized: 0, lazyFunctionsRemaining: 0 };
				}
				totalLazyFunctionStats.totalFunctionDefinitions += data.lazyFunctionStats.totalFunctionDefinitions;
				totalLazyFunctionStats.lazyFunctionsMaterialized += data.lazyFunctionStats.lazyFunctionsMaterialized;
				totalLazyFunctionStats.lazyFunctionsRemaining += data.lazyFunctionStats.lazyFunctionsRemaining;
			}

			// Aggregate graph metrics
			if(data.graphMetrics) {
				if(!aggregateGraphMetrics) {
					aggregateGraphMetrics = { totalNodes: 0, totalSideEffects: 0, nodeTypeDistribution: {} };
				}
				aggregateGraphMetrics.totalNodes += data.graphMetrics.nodeCount;
				aggregateGraphMetrics.totalSideEffects += data.graphMetrics.sideEffectCount;
				for(const [type, count] of Object.entries(data.graphMetrics.nodeTypeDistribution)) {
					aggregateGraphMetrics.nodeTypeDistribution[type] = (aggregateGraphMetrics.nodeTypeDistribution[type] ?? 0) + count;
				}
			}

			// Aggregate source stats
			if(data.sourceCharacteristics) {
				if(!aggregateSourceStats) {
					aggregateSourceStats = { totalLineCount: 0, totalBytes: 0, totalFileCount: 0 };
				}
				aggregateSourceStats.totalLineCount += data.sourceCharacteristics.lineCount;
				aggregateSourceStats.totalBytes += data.sourceCharacteristics.totalBytes;
				aggregateSourceStats.totalFileCount += data.sourceCharacteristics.fileCount;
			}
		}

		const totalRuntimeMs = totalRuntimes.reduce((a, b) => a + b, 0);
		const meanProjectRuntimeMs = projects.length ? totalRuntimeMs / projects.length : 0;

		// Aggregate correctness stats
		let correctnessStats: { correct: number; imprecise: number; incorrect: number; skipped: number } | undefined;
		let hasCorrectness = false;
		for(const project of projects) {
			if(project.correctness !== 'skipped') {
				hasCorrectness = true;
				break;
			}
		}
		if(hasCorrectness) {
			correctnessStats = { correct: 0, imprecise: 0, incorrect: 0, skipped: 0 };
			for(const project of projects) {
				if(project.correctness === 'skipped') {
					correctnessStats.skipped++;
				} else {
					switch(project.correctness.classification) {
						case CorrectnessClassification.Correct:
							correctnessStats.correct++;
							break;
						case CorrectnessClassification.Imprecise:
							correctnessStats.imprecise++;
							break;
						case CorrectnessClassification.Incorrect:
							correctnessStats.incorrect++;
							break;
					}
				}
			}
		}

		console.log(`\nSuite ${suiteName}:`);
		console.log(`- Projects: ${projects.length}`);
		console.log(`- Total runtime: ${(totalRuntimeMs).toFixed(6)} ms`);
		console.log(`- Mean per project: ${(meanProjectRuntimeMs).toFixed(6)} ms`);
		console.log(`- Total files analyzed: ${totalFiles}`);
		if(correctnessStats) {
			console.log(
				`- Correctness: ${correctnessStats.correct} ${correctnessClassificationToName(CorrectnessClassification.Correct)}, ` +
				`${correctnessStats.imprecise} ${correctnessClassificationToName(CorrectnessClassification.Imprecise)}, ` +
				`${correctnessStats.incorrect} ${correctnessClassificationToName(CorrectnessClassification.Incorrect)}, ` +
				`${correctnessStats.skipped} skipped`
			);
		}
		if(totalLazyFunctionStats) {
			console.log(`- Total function definitions: ${totalLazyFunctionStats.totalFunctionDefinitions}`);
			console.log(`- Functions materialized: ${totalLazyFunctionStats.lazyFunctionsMaterialized}`);
			console.log(`- Functions remaining lazy: ${totalLazyFunctionStats.lazyFunctionsRemaining}`);
		}
		if(aggregateGraphMetrics) {
			console.log(`- Graph nodes: ${aggregateGraphMetrics.totalNodes}, side effects: ${aggregateGraphMetrics.totalSideEffects}`);
		}
		if(aggregateSourceStats) {
			console.log(`- Source: ${aggregateSourceStats.totalLineCount} lines, ${(aggregateSourceStats.totalBytes / 1024 / 1024).toFixed(2)} MB, ${aggregateSourceStats.totalFileCount} files`);
		}

		suites.push({ suiteName, projects, totalRuntimeMs, meanProjectRuntimeMs, totalFiles, totalLazyFunctionStats, correctnessStats, aggregateGraphMetrics, aggregateSourceStats });
	}

	return suites;
}

function writeSummary(suites: SuiteSummary[], outputRoot: string) {
	fs.mkdirSync(outputRoot, { recursive: true });
	const summaryPath = path.join(outputRoot, 'summary.json');
	fs.writeFileSync(summaryPath, JSON.stringify(suites, null, 2), 'utf-8');

	const totalProjects = suites.reduce((sum, s) => sum + s.projects.length, 0);
	const totalRuntime = suites.reduce((sum, s) => sum + s.totalRuntimeMs, 0);
	const totalFiles = suites.reduce((sum, s) => sum + s.totalFiles, 0);

	// Aggregate lazy function stats across all suites
	let totalLazyStats: { totalFunctionDefinitions: number; lazyFunctionsMaterialized: number; lazyFunctionsRemaining: number } | undefined;
	for(const suite of suites) {
		if(suite.totalLazyFunctionStats) {
			if(!totalLazyStats) {
				totalLazyStats = { totalFunctionDefinitions: 0, lazyFunctionsMaterialized: 0, lazyFunctionsRemaining: 0 };
			}
			totalLazyStats.totalFunctionDefinitions += suite.totalLazyFunctionStats.totalFunctionDefinitions;
			totalLazyStats.lazyFunctionsMaterialized += suite.totalLazyFunctionStats.lazyFunctionsMaterialized;
			totalLazyStats.lazyFunctionsRemaining += suite.totalLazyFunctionStats.lazyFunctionsRemaining;
		}
	}

	// Aggregate correctness stats across all suites
	let totalCorrectnessStats: { correct: number; imprecise: number; incorrect: number; skipped: number } | undefined;
	for(const suite of suites) {
		if(suite.correctnessStats) {
			if(!totalCorrectnessStats) {
				totalCorrectnessStats = { correct: 0, imprecise: 0, incorrect: 0, skipped: 0 };
			}
			totalCorrectnessStats.correct += suite.correctnessStats.correct;
			totalCorrectnessStats.imprecise += suite.correctnessStats.imprecise;
			totalCorrectnessStats.incorrect += suite.correctnessStats.incorrect;
			totalCorrectnessStats.skipped += suite.correctnessStats.skipped;
		}
	}

	// Aggregate graph metrics across all suites
	let totalGraphMetrics: { totalNodes: number; totalSideEffects: number; nodeTypeDistribution: Record<string, number> } | undefined;
	for(const suite of suites) {
		if(suite.aggregateGraphMetrics) {
			if(!totalGraphMetrics) {
				totalGraphMetrics = { totalNodes: 0, totalSideEffects: 0, nodeTypeDistribution: {} };
			}
			totalGraphMetrics.totalNodes += suite.aggregateGraphMetrics.totalNodes;
			totalGraphMetrics.totalSideEffects += suite.aggregateGraphMetrics.totalSideEffects;
			for(const [type, count] of Object.entries(suite.aggregateGraphMetrics.nodeTypeDistribution)) {
				totalGraphMetrics.nodeTypeDistribution[type] = (totalGraphMetrics.nodeTypeDistribution[type] ?? 0) + count;
			}
		}
	}

	// Aggregate source stats across all suites
	let totalSourceStats: { totalLineCount: number; totalBytes: number; totalFileCount: number } | undefined;
	for(const suite of suites) {
		if(suite.aggregateSourceStats) {
			if(!totalSourceStats) {
				totalSourceStats = { totalLineCount: 0, totalBytes: 0, totalFileCount: 0 };
			}
			totalSourceStats.totalLineCount += suite.aggregateSourceStats.totalLineCount;
			totalSourceStats.totalBytes += suite.aggregateSourceStats.totalBytes;
			totalSourceStats.totalFileCount += suite.aggregateSourceStats.totalFileCount;
		}
	}

	console.log('\n=== Summary written ===');
	console.log(`- ${summaryPath}`);
	console.log(`Total suites: ${suites.length}`);
	console.log(`Total projects: ${totalProjects}`);
	console.log(`Total runtime across all suites: ${(totalRuntime / 1000).toFixed(2)} s`);
	console.log(`Total files analyzed: ${totalFiles}`);
	if(totalCorrectnessStats) {
		console.log('\n=== Correctness Statistics ===');
		console.log(`Projects with ${correctnessClassificationToName(CorrectnessClassification.Correct)} graphs: ${totalCorrectnessStats.correct}`);
		console.log(`Projects with ${correctnessClassificationToName(CorrectnessClassification.Imprecise)} graphs: ${totalCorrectnessStats.imprecise}`);
		console.log(`Projects with ${correctnessClassificationToName(CorrectnessClassification.Incorrect)} graphs: ${totalCorrectnessStats.incorrect}`);
		console.log(`Projects with skipped correctness: ${totalCorrectnessStats.skipped}`);
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
		console.log(`Total nodes: ${totalGraphMetrics.totalNodes}`);
		console.log(`Total side effects: ${totalGraphMetrics.totalSideEffects}`);
		console.log('Node type distribution:');
		for(const [type, count] of Object.entries(totalGraphMetrics.nodeTypeDistribution).sort((a, b) => b[1] - a[1])) {
			console.log(`  ${type}: ${count}`);
		}
	}
	if(totalSourceStats) {
		console.log('\n=== Source Code Statistics ===');
		console.log(`Total lines of code: ${totalSourceStats.totalLineCount}`);
		console.log(`Total source size: ${(totalSourceStats.totalBytes / 1024 / 1024).toFixed(2)} MB`);
		console.log(`Total files: ${totalSourceStats.totalFileCount}`);
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
