import * as fs from 'fs';
import * as path from 'path';

type CliConfig = {
	targetFileCount: number;
	outputDir:       string;
};

type ProjectEntry = {
	projectPath: string;
	suitePath:   string;
	fileCount:   number;
};

// Define the suites to sample from.
const SuitePaths = [
	'/home/jonas/Git/ba-thesis/ssoc-data/sources/0-Journal_of_Statistical_Software_Output.csv-output',
	'/home/jonas/Git/ba-thesis/ssoc-data/sources/1-Zenodo_Output.csv-output',
	'/home/jonas/Git/ba-thesis/ssoc-data/sources/2-Figshare_Output.csv-output',
	'/home/jonas/Git/ba-thesis/ssoc-data/sources/dataverse/doi-10-7910/DVN',
] as const;

const DefaultTargetFileCount = 1_000;
const DefaultOutputDir = '/home/jonas/Git/ba-thesis/datasets/random-sampled';
const ExcludedProjectKeys = new Set<string>([
	'1-Zenodo_Output.csv-output/201',
	'1-Zenodo_Output.csv-output/491',
	'1-Zenodo_Output.csv-output/497',
	'DVN/ERNXOP',
	'DVN/DBNBEU',
	'DVN/CV9AYE',
	'DVN/HDOEPP',
	'DVN/L1YR71',
	'DVN/HPDN3I',
	'DVN/FJIQQR',
	'DVN/OD5MBX',
	'DVN/HFXXEF',
	'DVN/QXBZOZ',
	'DVN/KE92DO',
	'DVN/5KDUTD',
	'DVN/I0VEMG',
	'DVN/56L9JP',
	'DVN/10MM4N',
	'DVN/IK3DGT',
	'DVN/U6EWUW',
	'DVN/ZURHQA',
	'DVN/SEHMGR',
	'DVN/9RBEPV',
	'DVN/8EHQWP',
	'DVN/KL36TP',
]);

function parseArgs(args: readonly string[]): CliConfig {
	const targetFileCountArg = readArgValue(args, '--targetFiles');
	const outputDirArg = readArgValue(args, '--outputDir');

	const targetFileCount = targetFileCountArg !== undefined ? Number.parseInt(targetFileCountArg, 10) : DefaultTargetFileCount;
	if(!Number.isFinite(targetFileCount) || targetFileCount <= 0) {
		throw new Error(`Invalid --targetFiles value: ${targetFileCountArg}`);
	}

	return {
		targetFileCount,
		outputDir: path.resolve(outputDirArg ?? DefaultOutputDir),
	};
}

function readArgValue(args: readonly string[], name: string): string | undefined {
	const idx = args.indexOf(name);
	if(idx < 0 || idx + 1 >= args.length) {
		return undefined;
	}
	return args[idx + 1];
}

function countFilesInDir(dir: string): number {
	let total = 0;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for(const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if(entry.isDirectory()) {
			total += countFilesInDir(fullPath);
		} else {
			total += 1;
		}
	}
	return total;
}

function collectProjects(suitePaths: readonly string[]): ProjectEntry[] {
	const projectPaths = new Set<string>();
	const projects: ProjectEntry[] = [];

	for(const suitePath of suitePaths) {
		const resolvedSuitePath = path.resolve(suitePath);
		if(!fs.existsSync(resolvedSuitePath) || !fs.statSync(resolvedSuitePath).isDirectory()) {
			throw new Error(`Suite path does not exist or is not a directory: ${resolvedSuitePath}`);
		}

		const subDirs = fs.readdirSync(resolvedSuitePath, { withFileTypes: true })
			.filter(entry => entry.isDirectory())
			.map(entry => path.join(resolvedSuitePath, entry.name));

		for(const projectPath of subDirs) {
			const resolvedProjectPath = path.resolve(projectPath);
			if(projectPaths.has(resolvedProjectPath)) {
				continue;
			}
			projectPaths.add(resolvedProjectPath);
			projects.push({
				projectPath: resolvedProjectPath,
				suitePath:   resolvedSuitePath,
				fileCount:   countFilesInDir(resolvedProjectPath),
			});
		}
	}

	return projects;
}

function projectKey(project: ProjectEntry): string {
	return `${path.basename(project.suitePath)}/${path.basename(project.projectPath)}`;
}

function filterExcludedProjects(projects: readonly ProjectEntry[]): { included: ProjectEntry[]; filteredCount: number } {
	const included: ProjectEntry[] = [];
	let filteredCount = 0;

	for(const project of projects) {
		if(ExcludedProjectKeys.has(projectKey(project))) {
			filteredCount++;
			continue;
		}
		included.push(project);
	}

	return { included, filteredCount };
}

function shuffle<T>(input: readonly T[], random: () => number): T[] {
	const arr = [...input];
	for(let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function sampleProjects(projects: readonly ProjectEntry[], targetFileCount: number): ProjectEntry[] {
	const random = Math.random;
	let shuffled = projects;
	for(let i = 0; i < projects.length; i++) {
		shuffled = shuffle(shuffled, random);
	}
	const selected: ProjectEntry[] = [];
	let totalFiles = 0;

	for(const project of shuffled) {
		if(totalFiles >= targetFileCount) {
			break;
		}
		selected.push(project);
		totalFiles += project.fileCount;
	}

	return selected;
}

function uniqueTargetName(project: ProjectEntry, usedNames: Set<string>): string {
	const baseName = path.basename(project.projectPath);
	const suiteName = path.basename(project.suitePath);
	let candidate = `${baseName}`;

	if(!usedNames.has(candidate)) {
		usedNames.add(candidate);
		return candidate;
	}

	candidate = `${baseName}__${suiteName}`;
	if(!usedNames.has(candidate)) {
		usedNames.add(candidate);
		return candidate;
	}

	let suffix = 2;
	while(usedNames.has(`${candidate}__${suffix}`)) {
		suffix++;
	}
	const unique = `${candidate}__${suffix}`;
	usedNames.add(unique);
	return unique;
}

function copyProjectsToOutput(projects: readonly ProjectEntry[], outputDir: string): { copied: number; copiedFiles: number } {
	fs.rmSync(outputDir, { recursive: true, force: true });
	fs.mkdirSync(outputDir, { recursive: true });

	const usedNames = new Set<string>();
	let copiedFiles = 0;

	for(const project of projects) {
		const targetName = uniqueTargetName(project, usedNames);
		const targetPath = path.join(outputDir, targetName);
		fs.cpSync(project.projectPath, targetPath, { recursive: true });
		copiedFiles += project.fileCount;
	}

	return { copied: projects.length, copiedFiles };
}

function main(): void {
	const config = parseArgs(process.argv.slice(2));
	const discoveredProjects = collectProjects(SuitePaths);
	if(discoveredProjects.length === 0) {
		throw new Error('No projects found in configured suites.');
	}
	const { included: projects, filteredCount } = filterExcludedProjects(discoveredProjects);
	if(projects.length === 0) {
		throw new Error('No projects remain after applying exclusion filter.');
	}

	const selected = sampleProjects(projects, config.targetFileCount);
	const { copied, copiedFiles } = copyProjectsToOutput(selected, config.outputDir);

	console.log(`Configured suites: ${SuitePaths.length}`);
	console.log(`Collected projects: ${discoveredProjects.length}`);
	console.log(`Filtered projects: ${filteredCount}`);
	console.log(`Remaining projects: ${projects.length}`);
	console.log(`Target files: ${config.targetFileCount}`);
	console.log(`Sampled projects: ${selected.length}`);
	console.log(`Copied projects: ${copied}`);
	console.log(`Copied files: ${copiedFiles}`);
	console.log(`Output dir: ${config.outputDir}`);
	if(copiedFiles < config.targetFileCount) {
		console.warn(`Target not reached: copied ${copiedFiles}/${config.targetFileCount} files.`);
	}
}

main();
