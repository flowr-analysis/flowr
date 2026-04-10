import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { WorkerResult } from './results-types';

type Settings = {
    sourcesRoot:          string;
    workerJs:             string;
    resultsRoot:          string;
    runName:              string;
    maxProjectsPerSuite?: number;

    repetitions:      number;
    skipCorrectness?: boolean;

    optimizations?: {
        parallelFiles?:      boolean;
        parallelOperations?: boolean;
        lazyFunctions?:      boolean;
    };

    excludeSuites?: string[];

    // Arrays of threads for worker execution
    threadsForCorrectness?: number[];
    threadsForPerformance?: number[];
};

// --------------------------------------------------
// Load settings
// --------------------------------------------------
const ThisDir = __dirname;

// Default settings file
let settingsPath = path.join(ThisDir, 'settings.json');

// If the CLI provides --profile <path>, use that
const profileIndex = process.argv.indexOf('--profile');
if(profileIndex >= 0 && process.argv.length > profileIndex + 1) {
	settingsPath = path.resolve(ThisDir, process.argv[profileIndex + 1]);
}

if(!fs.existsSync(settingsPath)) {
	throw new Error(`Missing settings file at ${settingsPath}`);
}

const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Settings;

// Resolve paths relative to the settings file
const SettingsDir = path.dirname(settingsPath);
const SourcesRoot = path.resolve(SettingsDir, settings.sourcesRoot);
const WorlerJs = path.resolve(SettingsDir, settings.workerJs);
const ResultRoot = path.resolve(SettingsDir, settings.resultsRoot);
const OutputRoot = path.join(ResultRoot, settings.runName);

// Make output folder
fs.mkdirSync(OutputRoot, { recursive: true });

console.log('=== Benchmark settings loaded ===');
console.log(`Settings file: ${settingsPath}`);
console.log(`Run name: ${settings.runName}`);
console.log(`Sources root: ${SourcesRoot}`);
console.log(`Worker JS: ${WorlerJs}`);
console.log(`Results root: ${ResultRoot}`);


// ---------------- Discovery ----------------

function listSuites(root: string): string[] {
	if(!fs.existsSync(root)) {
		throw new Error(`Sources root does not exist: ${root}`);
	}
	let suites = fs.readdirSync(root, { withFileTypes: true })
		.filter(e => e.isDirectory())
		.map(e => e.name);

	if(settings.excludeSuites?.length) {
		suites = suites.filter(s => settings.excludeSuites ? !settings.excludeSuites.includes(s) : true);
	}
	return suites;
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

async function runOne(suite: string, projectDir: string, threads?: number, skipCorrectness?: boolean): Promise<void> {
	const projectName = path.basename(projectDir);
	let profileDir = path.join(OutputRoot, suite, projectName);
	if(threads) {
		profileDir += `-threads-${threads}`;
	}
	fs.mkdirSync(profileDir, { recursive: true });

	console.log(`\n=== Running: [${suite}] ${projectName}${threads ? ` | threads=${threads}` : ''} ===`);

	const args: string[] = [
		WorlerJs,
		projectDir,
		profileDir,
		String(settings.repetitions),
	];

	// Skip correctness if requested
	if(skipCorrectness || (settings.skipCorrectness ?? false)) {
		args.push('--skipCorrectness');
	}

	if(settings.optimizations?.parallelFiles) {
		args.push('--parallelFiles');
	}
	if(settings.optimizations?.parallelOperations) {
		args.push('--parallelOperations');
	}
	if(settings.optimizations?.lazyFunctions) {
		args.push('--lazyFunctions');
	}

	const child = spawn(
		'node',
		args,
		{ stdio: 'inherit' }
	);

	const exitCode: number | null = await new Promise(resolve => child.on('close', code => resolve(code)));
	if(exitCode !== 0) {
		throw new Error(`Run failed for [${suite}] ${projectName} (exit=${exitCode})`);
	}
}

async function runProjectForThreads(suite: string, projectPath: string): Promise<void> {
	const correctnessThreads = settings.threadsForCorrectness ?? [];
	const performanceThreads = settings.threadsForPerformance ?? [];


	for(const threads of performanceThreads) {
		const skipCorrectness = !correctnessThreads.includes(threads);
		await runOne(suite, projectPath, threads, skipCorrectness);
	}
}


async function runTestSuite(suiteName: string, suitePath: string): Promise<void> {
	console.log(`\n=== Suite: ${suiteName} ===`);
	const projects = listProjectsInSuite(suitePath, settings.maxProjectsPerSuite);
	console.log(`Found ${projects.length} projects in suite ${suiteName}`);

	for(const projectPath of projects) {
		await runProjectForThreads(suiteName, projectPath);
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
		successful:      number;
		withDifferences: number;
		skipped:         number;
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

function collectResults(): SuiteSummary[] {
	if(!fs.existsSync(OutputRoot)) {
		throw new Error(`Output directory does not exist: ${OutputRoot}`);
	}
	const suiteDirs = fs.readdirSync(OutputRoot, { withFileTypes: true })
		.filter(e => e.isDirectory())
		.map(e => path.join(OutputRoot, e.name));

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

			// Approximate runtime using wallMs stats mean
			if(data.wallMs.mean) {
				totalRuntimes.push(data.wallMs.mean);
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
		let correctnessStats: { successful: number; withDifferences: number; skipped: number } | undefined;
		let hasCorrectness = false;
		for(const project of projects) {
			if(project.correctness !== 'skipped') {
				hasCorrectness = true;
				break;
			}
		}
		if(hasCorrectness) {
			correctnessStats = { successful: 0, withDifferences: 0, skipped: 0 };
			for(const project of projects) {
				if(project.correctness === 'skipped') {
					correctnessStats.skipped++;
				} else if(project.correctness.ok) {
					correctnessStats.successful++;
				} else {
					correctnessStats.withDifferences++;
				}
			}
		}

		console.log(`\nSuite ${suiteName}:`);
		console.log(`- Projects: ${projects.length}`);
		console.log(`- Total runtime: ${(totalRuntimeMs).toFixed(6)} ms`);
		console.log(`- Mean per project: ${(meanProjectRuntimeMs).toFixed(6)} ms`);
		console.log(`- Total files analyzed: ${totalFiles}`);
		if(correctnessStats) {
			console.log(`- Correctness: ${correctnessStats.successful} successful, ${correctnessStats.withDifferences} with differences, ${correctnessStats.skipped} skipped`);
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

function writeSummary(suites: SuiteSummary[]) {
	fs.mkdirSync(OutputRoot, { recursive: true });
	const summaryPath = path.join(OutputRoot, 'summary.json');
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
	let totalCorrectnessStats: { successful: number; withDifferences: number; skipped: number } | undefined;
	for(const suite of suites) {
		if(suite.correctnessStats) {
			if(!totalCorrectnessStats) {
				totalCorrectnessStats = { successful: 0, withDifferences: 0, skipped: 0 };
			}
			totalCorrectnessStats.successful += suite.correctnessStats.successful;
			totalCorrectnessStats.withDifferences += suite.correctnessStats.withDifferences;
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
		console.log(`Projects with matching graphs: ${totalCorrectnessStats.successful}`);
		console.log(`Projects with differences: ${totalCorrectnessStats.withDifferences}`);
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
	console.log('=== Benchmark settings ===');
	console.log(`Sources root: ${SourcesRoot}`);
	console.log(`Worker JS:    ${WorlerJs}`);
	console.log(`Output dir:   ${OutputRoot}`);
	console.log(`Max projects per suite: ${settings.maxProjectsPerSuite ?? 'all'}`);
	console.log(`Repetitions: ${settings.repetitions}`);
	console.log(`Skip correctness: ${settings.skipCorrectness ?? false}`);
	console.log(`Optimizations: ${JSON.stringify(settings.optimizations ?? {}, null, 2)}`);
	console.log('Threads (correctness): ', settings.threadsForCorrectness);
	console.log('Threads (performance): ', settings.threadsForPerformance);

	fs.mkdirSync(OutputRoot, { recursive: true });

	const suites = listSuites(SourcesRoot);
	console.log(`\nFound ${suites.length} suites.`);

	for(const suiteName of suites) {
		const suitePath = path.join(SourcesRoot, suiteName);
		await runTestSuite(suiteName, suitePath);
	}

	const results = collectResults();
	writeSummary(results);
}

main().catch(err => {
	console.error('Benchmark failed:', err);
	process.exit(1);
});
