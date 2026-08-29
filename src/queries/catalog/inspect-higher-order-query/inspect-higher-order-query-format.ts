import { filterLineParser, type BaseQueryFormat, type BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { executeHigherOrderQuery } from './inspect-higher-order-query-executor';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import { criteriaQueryCompleter } from '../../../cli/repl/parser/slice-query-parser';
import { SourceLocation } from '../../../util/range';

/**
 * Either returns all function definitions alongside whether they are higher-order functions,
 * or just those matching the filters.
 */
export interface InspectHigherOrderQuery extends BaseQueryFormat {
	readonly type:    'inspect-higher-order';
	readonly filter?: readonly SlicingCriterion[]
}

export interface InspectHigherOrderQueryResult extends BaseQueryResult {
	readonly higherOrder: Record<NodeId, boolean>;
}

export const InspectHigherOrderQueryDefinition = {
	title:           'Inspect Higher-Order Functions Query',
	executor:        executeHigherOrderQuery,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'inspect-higher-order'>['inspect-higher-order'];
		result.push(`Query: ${bold('inspect-higher-order', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		for(const [r, v] of Object.entries(out.higherOrder)) {
			const node = (await processed.normalize()).idMap.get(NodeId.normalize(r));
			const loc = node ? SourceLocation.fromNode(node) : undefined;
			result.push(`  - Function ${bold(r, formatter)} (${SourceLocation.format(loc)}) is ${v ? '' : 'not '}a higher-order function`);
		}
		return true;
	},
	fromLine:  filterLineParser('inspect-higher-order'),
	completer: criteriaQueryCompleter,
	syntax:    '@inspect-higher-order [(<crit>;...)] <code | file://path>',
	schema:    Joi.object({
		type:   Joi.string().valid('inspect-higher-order').required().description('The type of the query.'),
		filter: Joi.array().items(Joi.string().required()).optional().description('If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered.')
	}).description('Either returns all function definitions alongside whether they are higher-order functions, or just those matching the filters.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'inspect-higher-order'>['inspect-higher-order'];
		return Object.keys(out.higherOrder).filter(id => out.higherOrder[id]);
	}
} as const satisfies SupportedQuery<'inspect-higher-order'>;
