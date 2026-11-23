import Joi from 'joi';
import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/text/ansi';
import { executeAliasesQuery } from './aliases-query-executor';
import type { SlicingCriteria, SlicingCriterion } from '../../../slicing/criterion/parse';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SourceLocation } from '../../../util/range';
import { isNotUndefined } from '../../../util/assert';

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
	asciiSummarizer: (formatter, _, queryResults, result) => {
		const out = queryResults as QueryResults<'aliases'>['aliases'];
		result.push(`Query: ${bold('aliases', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		for(const criterion of out.result) {
			const aliases = criterion[1].length === 0 ? '   ╰ has no aliases.' : `   ╰ has aliases ${criterion[1].map(elem => {
				return `[${elem.toString()}]`;
			})?.join(', ')}`;
			result.push(criterion[0].toString(), aliases);
		}
		return true;
	},
	schema: Joi.object({
		type:     Joi.string().valid('aliases').required().description('The type of the query.'),
		criteria: Joi.array().items(Joi.string()).optional().description('The slicing criteria of the nodes we want to find the alias for.'),
		id:       Joi.array().items(Joi.number()).optional().description('The NodeId of the nodes we want to find the alias for.')
	}).description('The alias query returns all aliases for the given function call marked as a slicing criterion.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'aliases'>['aliases'];
		return out.result.flatMap(elem => {
			if(typeof elem[1] === 'object' && elem[1] !== null && 'name' in elem[1] && elem[1].name === 'NodeId') {
				return elem[1] as NodeId[];
			}
		}).filter(elem => {
			isNotUndefined(elem);
		});
	}
} as const satisfies SupportedQuery<'aliases'>;