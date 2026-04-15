import * as fs from 'fs';
import * as path from 'path';

type BenchmarkSettings = {
	runName:     string;
	resultsRoot: string;
};

type SummaryProject = {
	project:            string;
	fileCount:          number;
	lazyFunctionStats?: {
		totalFunctionDefinitions:  number;
		lazyFunctionsMaterialized: number;
		lazyFunctionsRemaining:    number;
	};
	sourceCharacteristics?: {
		lineCount:  number;
		totalBytes: number;
		fileCount:  number;
	};
};

type SuiteSummary = {
	suiteName: string;
	projects:  SummaryProject[];
};

type DatasetProject = {
	project:                   string;
	suiteName:                 string;
	runName:                   string;
	fileCount:                 number;
	lineCount:                 number;
	totalBytes:                number;
	bytesPerFile:              number;
	totalFunctionDefinitions:  number;
	lazyFunctionsMaterialized: number;
	lazyFunctionsRemaining:    number;
	unmaterializedRatio:       number;
};

type GroupTarget = {
	name:                string;
	description:         string;
	targetCombinedFiles: number;
	score:               (project: DatasetProject) => number;
};

type GroupSelection = {
	name:        string;
	description: string;
	targets: {
		targetCombinedFiles: number;
	};
	achieved: {
		projectCount:  number;
		combinedFiles: number;
		targetReached: boolean;
	};
	projects: DatasetProject[];
	warnings: string[];
};

type DatasetOutput = {
	generatedAt:             string;
	settingsPath:            string;
	resultsRoot:             string;
	groupedProjectsRoot:     string;
	flatProjectCount:        number;
	loadedRuns:              string[];
	totalProjectsConsidered: number;
	groups:                  GroupSelection[];
};

const GroupedProjectsRoot = '/home/jonas/Git/ba-thesis/flowr/test/benchmark/benchmark-results/targeted-dataset';

function readJson<T>(filePath: string): T {
	if(!fs.existsSync(filePath)) {
		throw new Error(`File does not exist: ${filePath}`);
	}
	return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function parseArgs(args: readonly string[]): { settingsPath: string; outputPath?: string } {
	const settingsIndex = args.indexOf('--settings');
	if(settingsIndex < 0 || settingsIndex + 1 >= args.length) {
		throw new Error('Usage: ts-node test/benchmark/build-dataset.ts --settings <settings.json> [--output <dataset.json>]');
	}

	const outputIndex = args.indexOf('--output');
	return {
		settingsPath: path.resolve(args[settingsIndex + 1]),
		outputPath:   outputIndex >= 0 && outputIndex + 1 < args.length ? path.resolve(args[outputIndex + 1]) : undefined,
	};
}

function loadSettings(settingsPath: string): BenchmarkSettings {
	const parsed = readJson<Partial<BenchmarkSettings>>(settingsPath);
	if(typeof parsed.resultsRoot !== 'string' || parsed.resultsRoot.length === 0) {
		throw new Error('Settings must contain a non-empty string field "resultsRoot".');
	}
	if(parsed.runName === undefined || typeof parsed.runName !== 'string') {
		throw new Error('"runName" must be a string.');
	}
	return {
		resultsRoot: parsed.resultsRoot,
		runName:     parsed.runName,
	};
}

function resolveRunDir(resultsRoot: string, runName: string): string {
	if(!fs.existsSync(resultsRoot)) {
		throw new Error(`Results root does not exist: ${resultsRoot}`);
	}
	const runDir = path.join(resultsRoot, runName);
	if(!fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
		throw new Error(`Configured runName not found in resultsRoot: ${runName}`);
	}
	return runDir;
}

function loadSummary(summaryPath: string): SuiteSummary[] {
	const data = readJson<unknown>(summaryPath);
	if(!Array.isArray(data)) {
		throw new Error(`Summary must be an array: ${summaryPath}`);
	}

	return data as SuiteSummary[];
}

function toDatasetProjects(runDir: string, suites: readonly SuiteSummary[]): DatasetProject[] {
	const runName = path.basename(runDir);
	const projects: DatasetProject[] = [];

	for(const suite of suites) {
		for(const project of suite.projects) {
			const sourceFileCount = project.sourceCharacteristics?.fileCount ?? project.fileCount;
			const totalBytes = project.sourceCharacteristics?.totalBytes ?? 0;
			const lineCount = project.sourceCharacteristics?.lineCount ?? 0;
			const totalFunctionDefinitions = project.lazyFunctionStats?.totalFunctionDefinitions ?? 0;
			const lazyFunctionsMaterialized = project.lazyFunctionStats?.lazyFunctionsMaterialized ?? 0;
			const lazyFunctionsRemaining = project.lazyFunctionStats?.lazyFunctionsRemaining ?? 0;
			const unmaterializedRatio = totalFunctionDefinitions > 0 ? lazyFunctionsRemaining / totalFunctionDefinitions : 0;
			const normalizedFileCount = Math.max(1, sourceFileCount);
			const bytesPerFile = totalBytes / normalizedFileCount;

			projects.push({
				project:   project.project,
				suiteName: suite.suiteName,
				runName,
				fileCount: sourceFileCount,
				lineCount,
				totalBytes,
				bytesPerFile,
				totalFunctionDefinitions,
				lazyFunctionsMaterialized,
				lazyFunctionsRemaining,
				unmaterializedRatio,
			});
		}
	}

	return projects;
}

const GroupTargets: readonly GroupTarget[] = [
	{
		name:                'parallel',
		description:         'Projects with many files (good candidates for file-level parallelism).',
		targetCombinedFiles: 150,
		score:               project => project.fileCount,
	},
	{
		name:                'lazy',
		description:         'Projects with high ratio of unmaterialized functions.',
		targetCombinedFiles: 150,
		score:               project => project.unmaterializedRatio,
	},
	{
		name:                'small-files',
		description:         'Projects dominated by small files (low bytes per file).',
		targetCombinedFiles: 50,
		score:               project => -project.bytesPerFile,
	},
	{
		name:                'large-files',
		description:         'Projects dominated by large files (high bytes per file).',
		targetCombinedFiles: 50,
		score:               project => project.bytesPerFile,
	},
	{
		name:                'few-files',
		description:         'Projects with very few files.',
		targetCombinedFiles: 50,
		score:               project => -project.fileCount,
	},
	{
		name:                'non-lazy',
		description:         'Projects with low ratio of unmaterialized functions.',
		targetCombinedFiles: 50,
		score:               project => (1 - project.unmaterializedRatio),
	},
];

function selectForGroup(target: GroupTarget, pool: readonly DatasetProject[]): GroupSelection {
	const candidates = [...pool]
		.sort((left: DatasetProject, right: DatasetProject) => {
			const scoreDiff = target.score(right) - target.score(left);
			if(scoreDiff !== 0) {
				return scoreDiff;
			}
			return right.fileCount - left.fileCount;
		});

	const selected: DatasetProject[] = [];
	let combinedFiles = 0;

	for(const candidate of candidates) {
		if(combinedFiles >= target.targetCombinedFiles) {
			break;
		}
		selected.push(candidate);
		combinedFiles += candidate.fileCount;
	}

	const warnings: string[] = [];
	if(combinedFiles < target.targetCombinedFiles) {
		warnings.push(`Target not met: selected ${combinedFiles}/${target.targetCombinedFiles} combined files.`);
	}

	return {
		name:        target.name,
		description: target.description,
		targets:     {
			targetCombinedFiles: target.targetCombinedFiles,
		},
		achieved: {
			projectCount:  selected.length,
			combinedFiles,
			targetReached: warnings.length === 0,
		},
		projects: selected,
		warnings,
	};
}

function selectGroupsWithoutDuplicates(targets: readonly GroupTarget[], pool: readonly DatasetProject[]): GroupSelection[] {
	let remaining = [...pool];
	const groups: GroupSelection[] = [];

	for(const target of targets) {
		const selected = selectForGroup(target, remaining);
		groups.push(selected);
		const selectedProjects = new Set(selected.projects.map(project => project.project));
		remaining = remaining.filter(project => !selectedProjects.has(project.project));
	}

	return groups;
}

function collectFlatUniqueProjects(groups: readonly GroupSelection[]): DatasetProject[] {
	const unique = new Map<string, DatasetProject>();
	for(const group of groups) {
		for(const project of group.projects) {
			if(!unique.has(project.project)) {
				unique.set(project.project, project);
			}
		}
	}
	return [...unique.values()];
}

function uniqueTargetDirName(sourcePath: string, usedNames: Set<string>): string {
	const baseName = path.basename(sourcePath);
	if(!usedNames.has(baseName)) {
		usedNames.add(baseName);
		return baseName;
	}

	const parentName = path.basename(path.dirname(sourcePath));
	let candidate = `${baseName}__${parentName}`;
	if(!usedNames.has(candidate)) {
		usedNames.add(candidate);
		return candidate;
	}

	let suffix = 2;
	while(usedNames.has(`${candidate}__${suffix}`)) {
		suffix++;
	}
	candidate = `${candidate}__${suffix}`;
	usedNames.add(candidate);
	return candidate;
}

function copyGroupedProjects(projects: readonly DatasetProject[]): void {
	fs.rmSync(GroupedProjectsRoot, { recursive: true, force: true });
	fs.mkdirSync(GroupedProjectsRoot, { recursive: true });
	const usedTargetNames = new Set<string>();

	for(const project of projects) {
		const targetDirName = uniqueTargetDirName(project.project, usedTargetNames);
		const targetDir = path.join(GroupedProjectsRoot, targetDirName);
		fs.cpSync(project.project, targetDir, { recursive: true });
	}
}

function main(): void {
	const { settingsPath, outputPath } = parseArgs(process.argv.slice(2));
	const settings = loadSettings(settingsPath);
	const settingsDir = path.dirname(settingsPath);
	const resultsRoot = path.resolve(settingsDir, settings.resultsRoot);
	const runDir = resolveRunDir(resultsRoot, settings.runName);
	const allProjects = toDatasetProjects(runDir, loadSummary(path.join(runDir, 'summary.json')));

	if(allProjects.length === 0) {
		throw new Error('No projects loaded from summaries.');
	}

	const groups = selectGroupsWithoutDuplicates(GroupTargets, allProjects);
	const flatUniqueProjects = collectFlatUniqueProjects(groups);
	copyGroupedProjects(flatUniqueProjects);
	const dataset: DatasetOutput = {
		generatedAt:             new Date().toISOString(),
		settingsPath,
		resultsRoot,
		groupedProjectsRoot:     GroupedProjectsRoot,
		flatProjectCount:        flatUniqueProjects.length,
		loadedRuns:              [path.basename(runDir)],
		totalProjectsConsidered: allProjects.length,
		groups,
	};

	const resolvedOutputPath = outputPath ?? path.join(runDir, 'dataset-selection.json');
	fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
	fs.writeFileSync(resolvedOutputPath, JSON.stringify(dataset, null, 2), 'utf-8');

	console.log(`Dataset selection written to ${resolvedOutputPath}`);
	console.log(`Grouped projects copied to ${GroupedProjectsRoot}`);
	console.log(`Total unique copied projects: ${flatUniqueProjects.length}`);
	for(const group of groups) {
		console.log(
			`- ${group.name}: ${group.achieved.projectCount} projects, ` +
			`${group.achieved.combinedFiles} files, target reached=${group.achieved.targetReached}`
		);
		for(const warning of group.warnings) {
			console.warn(`  warning: ${warning}`);
		}
	}
}

main();
