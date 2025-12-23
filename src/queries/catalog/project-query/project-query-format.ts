import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeProjectQuery } from './project-query-executor';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { RAuthorInfo } from '../../../util/r-author';
import { rAuthorInfoToReadable } from '../../../util/r-author';
import type { Info } from 'spdx-expression-parse';


export interface ProjectQuery extends BaseQueryFormat {
	readonly type:       'project';
    /** Whether to include Dataflow information in the result. */
    readonly withDf?: boolean;
}

export interface ProjectQueryResult extends BaseQueryResult {
	/** The authors of the project. */
	readonly authors?:  RAuthorInfo[];
	/** The files considered part of the project. */
	readonly files:     (string | '<inline>')[];
	/** The licenses of the project. */
	readonly licenses?: Info[];
	/** The encoding of the project files. */
	readonly encoding?: string;
	/** The version of the project, if available. */
	readonly version?:  string;
}

export const ProjectQueryDefinition = {
	executor:        executeProjectQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'project'>['project'];
		result.push(`Query: ${bold('project', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		if(out.version) {
			result.push(`   ╰ Version: ${out.version}`);
		}
		if(out.encoding) {
			result.push(`   ╰ Encoding: ${out.encoding}`);
		}
		if(out.authors && out.authors.length > 0) {
			result.push('   ╰ Author(s):');
			for(const author of out.authors) {
				result.push(`      ╰ ${rAuthorInfoToReadable(author)}`);
			}
		}
		if(out.licenses && out.licenses.length > 0) {
			result.push('   ╰ License(s):');
			for(const license of out.licenses) {
				result.push(`      ╰ ${JSON.stringify(license)}`);
			}
		}
		result.push(`   ╰ Dataflow Analysis considered ${out.files.length} file${out.files.length === 1 ? '' : 's'}`);
		for(const file of out.files.slice(0, 20)) {
			result.push(`      ╰ \`${file}\``);
		}
		if(result.length > 20) {
			result.push(`      ╰ ... and ${out.files.length - 20} more files`);
		}
		return true;
	},
	schema: Joi.object({
		type:   Joi.string().valid('project').required().description('The type of the query.'),
		withDf: Joi.boolean().optional().default(false).description('Whether to include Dataflow information in the result.')
	}).description('The project query provides information on the analyzed project.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'project'>;
