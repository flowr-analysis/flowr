import { log } from '../../../util/log';
import type { ProjectDependencyStats, ProjectQuery, ProjectQueryResult } from './project-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { FileRole } from '../../../project/context/flowr-file';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from '../../../project/context/flowr-analyzer-dependencies-context';
import type { DeclaredPackages } from '../../../project/context/flowr-analyzer-meta-context';
import { baseRPackages } from '../../../util/r-base-packages';

/**
 * Collects dependency statistics from what the project declares, cross-referenced with the
 * loaded signature database(s) to report how many dependencies we can cover.
 */
function collectDependencyStats(declared: DeclaredPackages, deps: ReadOnlyFlowrAnalyzerDependenciesContext, basePackages: ReadonlySet<string>): ProjectDependencyStats {
	const imports = declared.imports ?? [];
	const dependsAll = declared.depends ?? [];
	const rEntry = dependsAll.find(d => d.name === 'R');
	const rVersion = rEntry?.derivedVersion?.raw;
	const depends = dependsAll.filter(d => d.name !== 'R');
	const suggests = declared.suggests ?? [];
	const linkingTo = declared.linkingTo ?? [];

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
	const roleCounts: Record<FileRole, number> = {} as Record<FileRole, number>;
	for(const file of Object.values(FileRole)) {
		roleCounts[file] = ctx.files.getFilesByRole(file).length;
	}
	// whichever plugin read the metadata (DESCRIPTION, rproject.toml, a lockfile) contributed it to the context,
	// so nothing here has to know which file the project happens to use
	const declared = ctx.meta.getDeclaredPackages();
	const hasDeclarations = Object.values(declared).some(g => g !== undefined);
	return {
		'.meta': {
			timing: Date.now() - startTime
		},
		name:         ctx.meta.getProjectName() ?? ctx.meta.getProjectTitle(),
		files:        Array.from(ctx.files.consideredFilesList()),
		authors:      ctx.meta.getAuthors(),
		encoding:     ctx.meta.getEncoding(),
		version:      ctx.meta.getProjectVersion()?.str,
		rVersion:     ctx.meta.getRVersion(),
		licenses:     ctx.meta.getLicenses(),
		roleCounts:   roleCounts,
		kind:         ctx.projectKind(),
		dependencies: hasDeclarations ? collectDependencyStats(declared, ctx.deps, basePackages) : undefined
	};
}
