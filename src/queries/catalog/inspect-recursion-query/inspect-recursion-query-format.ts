import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { executeRecursionQuery } from './inspect-recursion-query-executor';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfigOptions } from '../../../config';
import { sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import { SourceLocation } from '../../../util/range';

/**
 * Either returns all function definitions alongside whether they are recursive,
 * or just those matching the filters.
 */
export interface InspectRecursionQuery extends BaseQueryFormat {
	readonly type:    'inspect-recursion';
	readonly filter?: SingleSlicingCriterion[]
}

export interface InspectRecursionQueryResult extends BaseQueryResult {
	readonly recursive: Record<NodeId, boolean>;
}

function inspectRecLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'inspect-recursion'> {
	const criteria = sliceCriteriaParser(line[0]);
	return {
		query: {
			type:   'inspect-recursion',
			filter: criteria
		},
		rCode: criteria ? line[1] : line[0]
	};
}

export const InspectRecursionQueryDefinition = {
	executor:        executeRecursionQuery,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'inspect-recursion'>['inspect-recursion'];
		result.push(`Query: ${bold('inspect-recursion', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		for(const [r, v] of Object.entries(out.recursive)) {
			const node = (await processed.normalize()).idMap.get(NodeId.normalize(r));
			const loc = node ? SourceLocation.fromNode(node) : undefined;
			result.push(`  - Function ${bold(r, formatter)} (${SourceLocation.format(loc)}) is ${v ? '' : 'not '}recursive`);
		}
		return true;
	},
	fromLine: inspectRecLineParser,
	schema:   Joi.object({
		type:   Joi.string().valid('inspect-recursion').required().description('The type of the query.'),
		filter: Joi.array().items(Joi.string().required()).optional().description('If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered.')
	}).description('Either returns all function definitions alongside whether they are recursive, or just those matching the filters.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'inspect-recursion'>['inspect-recursion'];
		return Object.keys(out.recursive).filter(id => out.recursive[id]);
	}
} as const satisfies SupportedQuery<'inspect-recursion'>;
