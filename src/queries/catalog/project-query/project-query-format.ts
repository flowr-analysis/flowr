import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeProjectQuery } from './project-query-executor';
import { bold, ColorEffect, Colors } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { RAuthorInfo } from '../../../util/r-author';
import { rAuthorInfoToReadable } from '../../../util/r-author';
import type { RLicenseElementInfo } from '../../../util/r-license';
import { stringifyRLicense } from '../../../util/r-license';
import type { FileRole } from '../../../project/context/flowr-file';
import type { ProjectKind } from '../../../project/context/project-kind';


export interface ProjectQuery extends BaseQueryFormat {
	readonly type:    'project';
	/** Whether to include Dataflow information in the result. */
	readonly withDf?: boolean;
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
	readonly first:     { name: string, base: boolean, dbVersion?: string }[];
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
}

function addSuffix(count: number, singular = '', plural = 's'): string {
	return `${count === 1 ? singular : plural}`;
}

export const ProjectQueryDefinition = {
	executor:        executeProjectQuery,
	asciiSummarizer: (formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'project'>['project'];
		result.push(`Query: ${bold('project', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
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
		if(out.roleCounts) {
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
		if(analyzer.peekDataflow() === undefined) {
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
		type:   Joi.string().valid('project').required().description('The type of the query.'),
		withDf: Joi.boolean().optional().default(false).description('Whether to include Dataflow information in the result.')
	}).description('The project query provides information on the analyzed project.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'project'>;
