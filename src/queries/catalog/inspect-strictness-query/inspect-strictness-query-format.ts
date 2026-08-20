import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { executeStrictnessQuery } from './inspect-strictness-query-executor';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { queryLineCode, sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import { SourceLocation } from '../../../util/range';
import type { FunctionStrictness } from '../../../dataflow/fn/strict-function';
import { Ternary } from '../../../util/logic';

/**
 * Either returns all function definitions alongside whether they are strict,
 * or just those matching the filters.
 */
export interface InspectStrictnessQuery extends BaseQueryFormat {
	readonly type:    'inspect-strictness';
	readonly filter?: SlicingCriterion[]
}

export interface InspectStrictnessQueryResult extends BaseQueryResult {
	readonly strictness: Record<NodeId, FunctionStrictness>;
}

function inspectStrictLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'inspect-strictness'> {
	const criteria = sliceCriteriaParser(line[0]);
	return {
		query: {
			type:   'inspect-strictness',
			filter: criteria
		},
		rCode: queryLineCode(line, criteria ? 1 : 0)
	};
}

/** How a verdict reads in a sentence, `always`, `never`, or `conditionally` strict. */
function phrase(value: Ternary): string {
	return value === Ternary.Maybe ? 'conditionally' : value;
}

export const InspectStrictnessQueryDefinition = {
	title:           'Inspect Strict Functions Query',
	executor:        executeStrictnessQuery,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'inspect-strictness'>['inspect-strictness'];
		result.push(`Query: ${bold('inspect-strictness', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		const idMap = (await processed.normalize()).idMap;
		for(const [id, info] of Object.entries(out.strictness)) {
			const node = idMap.get(NodeId.normalize(id));
			const loc = node ? SourceLocation.fromNode(node) : undefined;
			const params = Object.entries(info.parameters)
				.map(([param, value]) => `${idMap.get(NodeId.normalize(param))?.lexeme ?? param}: ${phrase(value)}`)
				.join(', ');
			result.push(`  - Function ${bold(id, formatter)} (${SourceLocation.format(loc)}) is ${phrase(info.strict)} strict${params.length > 0 ? ` (${params})` : ''}`);
		}
		return true;
	},
	fromLine: inspectStrictLineParser,
	syntax:   '@inspect-strictness [(<crit>;...)] <code | file://path>',
	schema:   Joi.object({
		type:   Joi.string().valid('inspect-strictness').required().description('The type of the query.'),
		filter: Joi.array().items(Joi.string().required()).optional().description('If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered.')
	}).description('Either returns all function definitions alongside whether they are strict, or just those matching the filters.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'inspect-strictness'>['inspect-strictness'];
		return Object.keys(out.strictness).filter(id => out.strictness[id].strict === Ternary.Always);
	}
} as const satisfies SupportedQuery<'inspect-strictness'>;
