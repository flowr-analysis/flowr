import type { BrandedNamespace } from '../../../dataflow/environments/identifier';
import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import { queryHeader } from '../../query-print';
import { ColorEffect, Colors } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { RAuthorInfo } from '../../../util/r-author';
import { rAuthorInfoToReadable } from '../../../util/r-author';
import type { RLicenseElementInfo } from '../../../util/r-license';
import { stringifyRLicense } from '../../../util/r-license';
import type { ProjectKind } from '../../../project/context/project-kind';
import { log } from '../../../util/log';
import path from 'path';
import { metaSince } from '../../query-meta';
import { FileRole } from '../../../project/context/flowr-file';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from '../../../project/context/flowr-analyzer-dependencies-context';
import type { DeclaredPackages } from '../../../project/context/flowr-analyzer-meta-context';
import { baseRPackages } from '../../../util/r-base-packages';

/**
 * Collects dependency statistics from what the project declares, cross-referenced with the
 * loaded signature database(s) to report how many dependencies we can cover.
 */
function collectDependencyStats(declared: DeclaredPackages, deps: ReadOnlyFlowrAnalyzerDependenciesContext, basePackages: ReadonlySet<BrandedNamespace>): ProjectDependencyStats {
	const imports = declared.imports ?? [];
	const dependsAll = declared.depends ?? [];
	const rEntry = dependsAll.find(d => d.name === 'R');
	const rVersion = rEntry?.derivedRange?.raw;
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
	const showFiles = queries.some(q => q.showFiles);
	// we need to know what is considered by the analyzer
	if(withDf) {
		await analyzer.dataflow();
	}

	const ctx = analyzer.inspectContext();
	const basePackages = new Set<BrandedNamespace>(ctx.config.project.basePackages ?? baseRPackages(ctx.resolvedRVersion));

	let roleCounts: Record<FileRole, number> | undefined;
	let roleFiles: Record<FileRole, readonly string[]> | undefined;
	if(showFiles) {
		roleFiles = {} as Record<FileRole, readonly string[]>;
		for(const file of Object.values(FileRole)) {
			roleFiles[file] = ctx.files.getFilesByRole(file).map(r => path.basename(r.path()));
		}
	} else {
		roleCounts = {} as Record<FileRole, number>;
		for(const file of Object.values(FileRole)) {
			roleCounts[file] = ctx.files.getFilesByRole(file).length;
		}
	}

	// whichever plugin read the metadata (DESCRIPTION, rproject.toml, a lockfile) contributed it to the context,
	// so nothing here has to know which file the project happens to use
	const declared = ctx.meta.getDeclaredPackages();
	const hasDeclarations = Object.values(declared).some(g => g !== undefined);
	return {
		...metaSince(startTime),
		name:         ctx.meta.getProjectName() ?? ctx.meta.getProjectTitle(),
		files:        Array.from(ctx.files.consideredFilesList()),
		authors:      ctx.meta.getAuthors(),
		encoding:     ctx.meta.getEncoding(),
		version:      ctx.meta.getProjectVersion()?.str,
		rVersion:     ctx.meta.getRVersion(),
		licenses:     ctx.meta.getLicenses(),
		roleCounts:   roleCounts,
		roleFiles:    roleFiles,
		kind:         ctx.projectKind(),
		dependencies: hasDeclarations ? collectDependencyStats(declared, ctx.deps, basePackages) : undefined,
		dfaPerformed: analyzer.peekDataflow() !== undefined
	};
}


export interface ProjectQuery extends BaseQueryFormat {
	readonly type:    'project';
	/** Whether to include Dataflow information in the result. */
	readonly withDf?: boolean;

	readonly showFiles?: boolean;
}

/** Statistics on the project's declared dependencies, cross-referenced with the signature database. */
export interface ProjectDependencyStats {
	/** Number of packages in the `Imports` field. */
	readonly imports:   number;
	/** Number of packages in the `Depends` field (excluding the `R` version pseudo-package). */
	readonly depends:   number;
	/** Number of packages in the `Suggests` field. */
	readonly suggests:  number;
	/** Number of packages in the `LinkingTo` field. */
	readonly linkingTo: number;
	/** Number of unique runtime dependencies (`Imports`, `Depends`, and `LinkingTo` combined). */
	readonly runtime:   number;
	/** How many of the runtime dependencies are base or recommended R packages. */
	readonly base:      number;
	/** How many of the non-base runtime dependencies are covered by the loaded signature database(s). */
	readonly covered:   number;
	/** The first few runtime dependencies with the version the signature database resolved them to, if any. */
	readonly first:     { name: BrandedNamespace, base: boolean, dbVersion?: string }[];
	/** The required R version derived from the `Depends` field, if declared. */
	readonly rVersion?: string;
}

export interface ProjectQueryResult extends BaseQueryResult {
	/** The name of the project, if available. */
	readonly name?:         string;
	/** The authors of the project. */
	readonly authors?:      RAuthorInfo[];
	/** The files considered part of the project. */
	readonly files:         (string | '<inline>')[];
	/** The counts of files by their role in the project. */
	readonly roleCounts?:   Record<FileRole, number>;
	/** The lists of files by their role in the project. */
	readonly roleFiles?:    Record<FileRole, readonly string[]>;
	/** The licenses of the project. */
	readonly licenses?:     RLicenseElementInfo[];
	/** The encoding of the project files. */
	readonly encoding?:     string;
	/** The version of the project, if available. */
	readonly version?:      string;
	/** The R version the project targets, e.g. the `r_version` of an `rproject.toml`. */
	readonly rVersion?:     string;
	/** The classified kind of the project (e.g. package, script, shiny app). */
	readonly kind?:         ProjectKind;
	/** Statistics on the project's declared dependencies, if a `DESCRIPTION` file is available. */
	readonly dependencies?: ProjectDependencyStats;
	/** Determines whether dataflow analysis already happened. */
	readonly dfaPerformed:  boolean;
}

function addSuffix(count: number, singular = '', plural = 's'): string {
	return `${count === 1 ? singular : plural}`;
}

export const ProjectQueryDefinition = {
	title:           'Project Query',
	executor:        executeProjectQuery,
	asciiSummarizer: (formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'project'>['project'];
		result.push(queryHeader('project', formatter, out['.meta'].timing));
		if(out.name) {
			result.push(`   ╰ Project Name: ${out.name}`);
		}
		if(out.kind) {
			result.push(`   ╰ Kind: ${out.kind}`);
		}
		if(out.version) {
			result.push(`   ╰ Version: ${out.version}`);
		}
		if(out.encoding) {
			result.push(`   ╰ Encoding: ${out.encoding}`);
		}
		if(out.authors && out.authors.length > 0) {
			result.push(`   ╰ Author${addSuffix(out.authors.length)}:`);
			for(const author of out.authors) {
				result.push(`      ╰ ${rAuthorInfoToReadable(author)}`);
			}
		}
		if(out.licenses && out.licenses.length > 0) {
			result.push(`   ╰ License${addSuffix(out.licenses.length)}:`);
			for(const license of out.licenses) {
				result.push(`      ╰ ${stringifyRLicense(license)}`);
			}
		}
		if(out.roleCounts)  {
			const entries = Object.entries(out.roleCounts).filter(([, count]) => count > 0);
			if(entries.length > 0) {
				result.push('   ╰ File Role Counts:');
				const longestRole = Math.max(...entries.map(([r]) => r.length));
				const longestCount = Math.max(...entries.map(([, c]) => String(c).length));
				for(const [role, count] of entries) {
					result.push(`      ╰ ${(role + ':').padEnd(longestRole + 1, ' ')} ${formatter.format(String(count).padStart(longestCount, ' '), {
						effect: ColorEffect.Foreground,
						color:  Colors.Cyan
					})}`);
				}
			}
		} else if(out.roleFiles) {
			const entries = Object.entries(out.roleFiles).filter(([, files]) => files.length > 0);
			if(entries.length > 0) {
				result.push('   ╰ File Role Counts:');
				const longestRole = Math.max(...entries.map(([r]) => r.length));
				const longestCount = Math.max(...entries.map(([, f]) => String(f.length).length));
				for(const [role, files] of entries) {
					const limit = 2;
					const displayedFiles = files.slice(0, limit).join(', ');
					const fileList = '[' + displayedFiles + (files.length > limit ? ', ...' : '') + ']';

					result.push(`      ╰ ${(role + ':').padEnd(longestRole + 1, ' ')} ${formatter.format(String(files.length).padStart(longestCount, ' '), {
						effect: ColorEffect.Foreground,
						color:  Colors.Cyan
					})} ${fileList}`);
				}
			}
		}
		if(out.dependencies) {
			const d = out.dependencies;
			result.push(`   ╰ Dependencies: ${d.runtime} runtime (${d.imports} imports, ${d.depends} depends, ${d.linkingTo} linkingTo), ${d.suggests} suggested`);
			result.push(`      ╰ ${d.base} base/recommended, ${d.covered}/${Math.max(d.runtime - d.base, 0)} non-base covered by the signature database`);
			if(d.first.length > 0) {
				const names = d.first.map(f => f.dbVersion ? `${f.name}@${f.dbVersion}` : f.name).join(', ');
				result.push(`      ╰ e.g. ${names}${d.runtime > d.first.length ? ', ...' : ''}`);
			}
			if(d.rVersion) {
				result.push(`      ╰ Requires R ${d.rVersion}`);
			}
		}
		if(!out.dfaPerformed) {
			result.push(formatter.format('   ╰ Dataflow not performed (run `:df#`, then re-run this query, or pass "withDf": true)', { color: Colors.White, effect: ColorEffect.Foreground }));
		} else {
			result.push(`   ╰ Dataflow Analysis considered ${out.files.length} file${out.files.length === 1 ? '' : 's'}`);
			for(const file of out.files.slice(0, 20)) {
				result.push(`      ╰ \`${file}\``);
			}
			if(out.files.length > 20) {
				result.push(`      ╰ ... and ${out.files.length - 20} more files`);
			}
		}
		return true;
	},
	schema: Joi.object({
		type:      Joi.string().valid('project').required().description('The type of the query.'),
		withDf:    Joi.boolean().optional().default(false).description('Whether to include Dataflow information in the result.'),
		showFiles: Joi.boolean().optional().default(false).description('Whether to include the list of files in the result.')
	}).description('The project query provides information on the analyzed project.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'project'>;
