import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeProjectQuery } from './project-query-executor';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';


export interface ProjectQuery extends BaseQueryFormat {
	readonly type:  'project';
	/** If set, only return the specified keys in the result. */
	readonly keys?: keyof ProjectQueryResult[];
	// TODO: type result correctly
}

/** https://r-pkgs.org/description.html#sec-description-authors-at-r */
export enum AuthorRole {
	/** the creator or maintainer, the person you should bother if you have problems. Despite being short for “creator”, this is the correct role to use for the current maintainer, even if they are not the initial creator of the package. */
	Creator = 'cre',
	/** authors, those who have made significant contributions to the package. */
	Author = 'aut',
	/** contributors, those who have made smaller contributions, like patches. */
	Contributor = 'ctb',
	/**  copyright holder. This is used to list additional copyright holders who are not authors, typically companies, like an employer of one or more of the authors. */
	CopyrightHolder = 'cph',
	/** funder, the people or organizations that have provided financial support for the development of the package. */
	Funder = 'fnd'
}

/**
 * Information about an author of the project.
 */
export interface ProjectAuthorInfo {
	/** The name (components) of the author. */
	readonly name:     string[];
	/** The email of the author, if available. */
	readonly email?:   string;
	/** The roles of the author in the project. */
	readonly roles:    AuthorRole[];
	/** The ORCID of the author, if available. */
	readonly orcid?:   string;
	/** Any additional comments about the author. */
	readonly comment?: string;
}

/**
 * Information about a license used in the project.
 */
export interface ProjectLicenseInfo {
	readonly name:  string;
	readonly url?:  string;
	readonly spdx?: string;
}

export interface ProjectQueryResult extends BaseQueryResult {
	/** The name of the project. */
	readonly name:     string;
	/** The authors of the project. */
	readonly authors:  ProjectAuthorInfo[];
	/** The files considered part of the project. */
	readonly files:    (string | '<inline>')[];
	/** The licenses of the project. */
	readonly licenses: ProjectLicenseInfo[];
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
