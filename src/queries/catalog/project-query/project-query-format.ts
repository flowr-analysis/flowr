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


export interface ProjectQuery extends BaseQueryFormat {
	readonly type:    'project';
	/** Whether to include Dataflow information in the result. */
	readonly withDf?: boolean;
}

export interface ProjectQueryResult extends BaseQueryResult {
	/** The name of the project, if available. */
	readonly name?:       string;
	/** The authors of the project. */
	readonly authors?:    RAuthorInfo[];
	/** The files considered part of the project. */
	readonly files:       (string | '<inline>')[];
	/** The counts of files by their role in the project. */
	readonly roleCounts?: Record<FileRole, number>;
	/** The licenses of the project. */
	readonly licenses?:   RLicenseElementInfo[];
	/** The encoding of the project files. */
	readonly encoding?:   string;
	/** The version of the project, if available. */
	readonly version?:    string;
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
		if(analyzer.peekDataflow() === undefined) {
			result.push(formatter.format('   ╰ Dataflow Analysis not performed', { color: Colors.White, effect: ColorEffect.Foreground }));
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
