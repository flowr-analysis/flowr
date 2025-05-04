import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeProjectQuery } from './project-query-executor';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';


export interface ProjectQuery extends BaseQueryFormat {
	readonly type: 'project';
}

export interface ProjectQueryResult extends BaseQueryResult {
	readonly files: (string | '<inline>')[];
}

export const ProjectQueryDefinition = {
	executor:        executeProjectQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'project'>['project'];
		result.push(`Query: ${bold('project', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(`   ╰ Contains ${out.files.length} file${out.files.length === 1 ? '' : 's'}`);
		for(const file of out.files) {
			result.push(`      ╰ \`${file}\``);
		}
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('project').required().description('The type of the query.'),
	}).description('The project query provides information on the analyzed project.')
} as const satisfies SupportedQuery<'project'>;
