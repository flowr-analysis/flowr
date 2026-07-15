import { log } from '../../../util/log';
import type { ProjectDependencyStats, ProjectQuery, ProjectQueryResult } from './project-query-format';
import { ProjectKind } from './project-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { FileRole } from '../../../project/context/flowr-file';
import type { FlowrDescriptionFile } from '../../../project/plugins/file-plugins/files/flowr-description-file';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from '../../../project/context/flowr-analyzer-dependencies-context';
import type { ReadOnlyFlowrAnalyzerFilesContext } from '../../../project/context/flowr-analyzer-files-context';
import { baseRPackages } from '../../../util/r-base-packages';
import path from 'path';

/**
 * Collects dependency statistics from the project's `DESCRIPTION` file, cross-referenced with the
 * loaded package database(s) to report how many dependencies we can cover.
 */
function collectDependencyStats(desc: FlowrDescriptionFile, deps: ReadOnlyFlowrAnalyzerDependenciesContext, basePackages: ReadonlySet<string>): ProjectDependencyStats {
	const imports = desc.imports() ?? [];
	const dependsAll = desc.depends() ?? [];
	const rEntry = dependsAll.find(d => d.name === 'R');
	const rVersion = rEntry?.derivedVersion?.raw;
	const depends = dependsAll.filter(d => d.name !== 'R');
	const suggests = desc.suggests() ?? [];
	const linkingTo = desc.linkingTo() ?? [];

	const runtime = new Set([...imports, ...depends, ...linkingTo].map(p => p.name));

	let base = 0;
	let covered = 0;
	const first: ProjectDependencyStats['first'] = [];
	for(const name of runtime) {
		const isBase = basePackages.has(name);
		const resolved = isBase ? undefined : deps.getDependency(name);
		if(isBase) {
			base++;
		} else if(resolved?.namespaceInfo) {
			covered++;
		}
		if(first.length < 3) {
			first.push({ name, base: isBase, dbVersion: resolved?.resolvedVersion });
		}
	}

	return {
		imports:   imports.length,
		depends:   depends.length,
		suggests:  suggests.length,
		linkingTo: linkingTo.length,
		runtime:   runtime.size,
		base,
		covered,
		first,
		rVersion:  rVersion && /\d/.test(rVersion) ? rVersion : undefined
	};
}

const notebookExtension = /\.(ipynb|rmd|qmd|rnw)$/;

/**
 * Classifies the {@link ProjectKind} of the given files context.
 *
 * A `DESCRIPTION` file unambiguously marks an R {@link ProjectKind.Package | package} and is available as soon
 * as the project is loaded. The finer distinctions ({@link ProjectKind.ShinyApp | shiny app},
 * {@link ProjectKind.Notebook | notebook}, {@link ProjectKind.Script | script} vs.
 * {@link ProjectKind.Project | multi-file project}) rely on the project's source files, which are only known
 * once the dataflow analysis has run; before that a non-package project reports {@link ProjectKind.Unknown}.
 *
 * This is a pure inspection of the files context and can be used standalone, independently of the project query.
 * @param files - the (read-only) files context of an analyzer to classify
 */
export function classifyProject(files: ReadOnlyFlowrAnalyzerFilesContext): ProjectKind {
	if(files.getFilesByRole(FileRole.Description).length > 0) {
		return ProjectKind.Package;
	}
	const names = new Set<string>([
		...files.getAllFiles().map(f => path.basename(f.path()).toLowerCase()),
		...files.consideredFilesList().map(p => path.basename(p).toLowerCase())
	]);
	if(names.size === 0) {
		return ProjectKind.Unknown;
	}
	if(names.has('app.r') || (names.has('ui.r') && names.has('server.r'))) {
		return ProjectKind.ShinyApp;
	}
	for(const name of names) {
		if(notebookExtension.test(name)) {
			return ProjectKind.Notebook;
		}
	}
	let rSources = 0;
	for(const name of names) {
		if(name.endsWith('.r')) {
			rSources++;
		}
	}
	return rSources <= 1 ? ProjectKind.Script : ProjectKind.Project;
}

/**
 * Executes the given project queries.
 */
export async function executeProjectQuery({ analyzer }: BasicQueryData, queries: readonly ProjectQuery[]): Promise<ProjectQueryResult> {
	if(queries.length !== 1) {
		log.warn('Project query expects only up to one query, but got', queries.length);
	}
	const startTime = Date.now();
	const withDf = queries.some(q => q.withDf);
	// we need to know what is considered by the analyzer
	if(withDf) {
		await analyzer.dataflow();
	}

	const ctx = analyzer.inspectContext();
	const basePackages = new Set(ctx.config.project.basePackages ?? baseRPackages(ctx.resolvedRVersion));
	const descFile = ctx.files.getFilesByRole(FileRole.Description);
	const desc: FlowrDescriptionFile | undefined = descFile[0];
	const roleCounts: Record<FileRole, number> = {} as Record<FileRole, number>;
	for(const file of Object.values(FileRole)) {
		roleCounts[file] = ctx.files.getFilesByRole(file).length;
	}
	return {
		'.meta': {
			timing: Date.now() - startTime
		},
		name:         desc?.content().get('Package')?.[0] ?? desc?.content()?.get('Title')?.[0],
		files:        Array.from(ctx.files.consideredFilesList()),
		authors:      desc?.authors(),
		encoding:     desc?.content().get('Encoding')?.[0],
		version:      desc?.content().get('Version')?.[0],
		licenses:     desc?.license(),
		roleCounts:   roleCounts,
		kind:         classifyProject(ctx.files),
		dependencies: desc ? collectDependencyStats(desc, ctx.deps, basePackages) : undefined
	};
}
