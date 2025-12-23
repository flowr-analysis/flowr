import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeProjectQuery } from './project-query-executor';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import type { RAuthorInfo } from '../../../util/r-author';
import type { Info } from 'spdx-expression-parse';


export interface ProjectQuery extends BaseQueryFormat {
	readonly type:  'project';
	/** If set, only return the specified keys in the result. */
	readonly keys?: keyof ProjectQueryResult[];
	// TODO: type result correctly
}

export interface ProjectQueryResult extends BaseQueryResult {
	/** The name of the project. */
	readonly name:     string;
	/** The authors of the project. */
	readonly authors:  RAuthorInfo[];
	/** The files considered part of the project. */
	readonly files:    (string | '<inline>')[];
	/** The licenses of the project. */
	readonly licenses: Info[];
	/** The encoding of the project files. */
	readonly encoding: string;
	/** The version of the project, if available. */
	readonly version?: string;
}

export const ProjectQueryDefinition = {
	executor:        executeProjectQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
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
	}).description('The project query provides information on the analyzed project.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'project'>;
