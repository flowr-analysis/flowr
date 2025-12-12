import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { executeFileQuery } from './files-query-executor';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { FileRole } from '../../../project/context/flowr-file';
import { jsonReplacer } from '../../../util/json';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfigOptions } from '../../../config';
import type { CommandCompletions } from '../../../cli/repl/core';
import { fileProtocol } from '../../../r-bridge/retriever';

/**
 * Returns the content(s) of all files matching the given pattern.
 */
export interface FilesQuery extends BaseQueryFormat {
	readonly type:              'files';
	readonly roles?:            FileRole[],
	readonly matchesPathRegex?: string;
}

export interface FileQueryInfo<T = object> {
	role?:   FileRole,
	path:    string,
	content: T
}

export interface FilesQueryResult extends BaseQueryResult {
	files: FileQueryInfo[]
}

function summarizeObjectWithLimit(obj: object, limitChars = 500, limitLines = 10): string {
	const str = JSON.stringify(obj, jsonReplacer, 2);
	if(str.split('\n').length > limitLines) {
		const lines = str.split('\n').slice(0, limitLines);
		return lines.join('\n') + '\n... (truncated)';
	} else if(str.length <= limitChars) {
		return str.slice(0, limitChars) + '... (truncated)';
	} else {
		return str;
	}
}


function rolesFromInput(rulesPart: readonly string[]): {valid: FileRole[], invalid: string[]} {
	return rulesPart
		.reduce((acc, ruleName) => {
			ruleName = ruleName.trim();
			// check if it is one of the values
			if(Object.values(FileRole).includes(ruleName as FileRole)) {
				acc.valid.push(ruleName as FileRole);
			} else {
				acc.invalid.push(ruleName);
			}
			return acc;
		}, { valid: [] as FileRole[], invalid: [] as string[] });
}

const rolePrefix = 'role:';

function filesQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'files'> {
	let roles: FileRole[] | undefined = undefined;
	let input: string | undefined = undefined;
	if(line.length > 0 && line[0].startsWith(rolePrefix)) {
		const rolesPart = line[0].slice(rolePrefix.length).split(',');
		const parseResult = rolesFromInput(rolesPart);
		if(parseResult.invalid.length > 0) {
			output.stderr(`Invalid roles: ${parseResult.invalid.map(r => bold(r, output.formatter)).join(', ')}`
				+`\nValid roles are: ${Object.values(FileRole).map(r => bold(r, output.formatter)).join(', ')}`);
		}
		roles = parseResult.valid;
		input = line[1];
	} else if(line.length > 0) {
		input = line[0];
	}
	return { query: [{ type: 'files', roles }], rCode: input } ;
}

function filesQueryCompleter(line: readonly string[], startingNewArg: boolean, _config: FlowrConfigOptions): CommandCompletions {
	const rolesPrefixNotPresent = line.length == 0 || (line.length == 1 && line[0].length < rolePrefix.length);
	const rolesNotFinished = line.length == 1 && line[0].startsWith(rolePrefix) && !startingNewArg;
	const endOfRules = line.length == 1 && startingNewArg || line.length == 2;

	if(rolesPrefixNotPresent) {
		return { completions: [`${rolePrefix}`] };
	} else if(endOfRules) {
		return { completions: [fileProtocol] };
	} else if(rolesNotFinished) {
		const rolesWithoutPrefix = line[0].slice(rolePrefix.length);
		const usedRoles = rolesWithoutPrefix.split(',').map(r => r.trim());
		const allRoles = Object.values(FileRole);
		const unusedRoles = allRoles.filter(r => !usedRoles.includes(r));
		const lastRole = usedRoles[usedRoles.length - 1];
		const lastRoleIsUnfinished = !allRoles.includes(lastRole as FileRole);

		if(lastRoleIsUnfinished) {
			return { completions: unusedRoles, argumentPart: lastRole };
		} else if(unusedRoles.length > 0) {
			return { completions: [','], argumentPart: '' };
		} else {
			return { completions: [' '], argumentPart: '' };
		}
	}
	return { completions: [] };
}

export const FilesQueryDefinition = {
	executor:        executeFileQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'files'>['files'];
		console.log(out);
		result.push(`Query: ${bold('files', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		result.push(`   ╰ Found ${out.files.length} file${out.files.length === 1 ? '' : 's'}`);
		for(const f of out.files) {
			result.push(`      ╰ ${bold(f.path, formatter)}${f.role ? ` [role: ${f.role}]` : ''}:`);
			const summary = summarizeObjectWithLimit(f.content);
			for(const line of summary.split('\n')) {
				result.push(`          ${line}`);
			}
		}
		return true;
	},
	completer: filesQueryCompleter,
	fromLine:  filesQueryLineParser,
	schema:    Joi.object({
		type:  Joi.string().valid('files').required().description('The type of the query.'),
		roles: Joi.array().optional().items(
			Joi.string().valid(...Object.values(FileRole))
		).description('Optional roles of the files to query. If not provided, all roles are considered.'),
		matchesPathRegex: Joi.string().optional().description('An optional regular expression to match the file paths against.')
	}).description('The file query finds files in the project based on their roles and path patterns.'),
	flattenInvolvedNodes: (_: BaseQueryResult): NodeId[] => {
		return [];
	}
} as const satisfies SupportedQuery<'files'>;
