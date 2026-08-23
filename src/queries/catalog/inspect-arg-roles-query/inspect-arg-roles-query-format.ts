import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { executeArgRolesQuery } from './inspect-arg-roles-query-executor';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { queryLineCode, sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import { SourceLocation } from '../../../util/range';
import type { FunctionArgumentRoles } from '../../../dataflow/fn/argument-roles';
import { ArgProps } from '../../../dataflow/environments/built-in-props';
import { ArgumentRoles } from '../../../dataflow/fn/argument-roles';

/**
 * Either returns all function definitions alongside what they do with their formals,
 * or just those matching the filters.
 */
export interface InspectArgRolesQuery extends BaseQueryFormat {
	readonly type:      'inspect-arg-roles';
	readonly filter?:   SlicingCriterion[]
	/** how far a value is followed back through names and calls (default {@link ArgumentRoles.maxDepth}) */
	readonly maxDepth?: number
}

export interface InspectArgRolesQueryResult extends BaseQueryResult {
	/** per function definition, the {@link ArgProp} mask of the formals that carry one */
	readonly roles: Record<NodeId, FunctionArgumentRoles>;
}

function inspectRolesLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'inspect-arg-roles'> {
	const criteria = sliceCriteriaParser(line[0]);
	return {
		query: {
			type:   'inspect-arg-roles',
			filter: criteria
		},
		rCode: queryLineCode(line, criteria ? 1 : 0)
	};
}

export const InspectArgRolesQueryDefinition = {
	title:           'Inspect Argument Roles Query',
	executor:        executeArgRolesQuery,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'inspect-arg-roles'>['inspect-arg-roles'];
		result.push(`Query: ${bold('inspect-arg-roles', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		const idMap = (await processed.normalize()).idMap;
		for(const [id, roles] of Object.entries(out.roles)) {
			const node = idMap.get(NodeId.normalize(id));
			const loc = node ? SourceLocation.fromNode(node) : undefined;
			const formals = Object.entries(roles)
				.map(([formal, props]) => `${idMap.get(NodeId.normalize(formal))?.lexeme ?? formal}: ${ArgProps.words(props).join(', ')}`)
				.join(', ');
			result.push(`  - Function ${bold(id, formatter)} (${SourceLocation.format(loc)}) ${formals}`);
		}
		return true;
	},
	fromLine: inspectRolesLineParser,
	syntax:   '@inspect-arg-roles [(<crit>;...)] <code | file://path>',
	schema:   Joi.object({
		type:     Joi.string().valid('inspect-arg-roles').required().description('The type of the query.'),
		filter:   Joi.array().items(Joi.string().required()).optional().description('If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered.'),
		maxDepth: Joi.number().integer().min(1).optional().description(`How far a value is followed back through names and calls when deciding what a formal stands for (default ${ArgumentRoles.maxDepth}).`)
	}).description('Either returns all function definitions alongside what they do with their formals, or just those matching the filters.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'inspect-arg-roles'>['inspect-arg-roles'];
		return Object.keys(out.roles);
	}
} as const satisfies SupportedQuery<'inspect-arg-roles'>;
