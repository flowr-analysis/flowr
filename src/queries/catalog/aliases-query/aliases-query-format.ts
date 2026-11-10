import Joi from 'joi';
import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/text/ansi';
import { executeAliasesQuery } from './aliases-query-executor';
import type { SlicingCriteria, SlicingCriterion } from '../../../slicing/criterion/parse';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isUndefined } from '../../../util/assert';
import type { SourceLocation } from '../../../util/range';

export interface AliasesQuery extends BaseQueryFormat {
	readonly type:      'aliases';
	readonly criteria?: SlicingCriteria;
	readonly id?:       NodeId[];
}
export interface AliasesQueryResult extends BaseQueryResult {
	readonly result: ([SlicingCriterion, SourceLocation[]] | [NodeId, NodeId[]])[];//Map<SlicingCriterion, SourceLocation[]>;
}

export const AliasesQueryDefinition = {
	title:           'Aliases Query',
	executor:        executeAliasesQuery,
	asciiSummarizer: async(formatter, analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'aliases'>['aliases'];
		result.push(`Query: ${bold('aliases', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		result.push('   ╰ Found aliases:');
		for(const criterion of out.result) {
			const aliases = isUndefined(criterion[1]) ? 'has no aliases.' : `has aliases ${criterion[1]?.join(', ')}`;
			result.push(criterion[0].toString(), aliases);
		}
		return true;
	},
	schema: Joi.object({
		type:     Joi.string().valid('aliases').required().description('The type of the query.'),
		criteria: Joi.array().items(Joi.string()).optional().description('The slicing criteria of the nodes we want to find the alias for.')
	}).description('The alias query returns all aliases for the given function call marked as a slicing criterion.'),
	/*flattenInvolvedNodes: (queryResults: BaseQueryResult): SourceLocation[] => {
		const out = queryResults as QueryResults<'aliases'>['aliases'];
		return Array.from(out.result.values()).filter(i => { return isNotUndefined(i); }).flatMap(id => id);
	}*/
} as const satisfies SupportedQuery<'aliases'>;