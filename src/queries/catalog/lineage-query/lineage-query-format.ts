import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';
import { executeLineageQuery } from './lineage-query-executor';

import { summarizeIdsIfTooLong } from '../../query-print';

/**
 * Calculates the lineage of the given criterion.
 */
export interface LineageQuery extends BaseQueryFormat {
	readonly type:      'lineage';
	readonly criterion: SingleSlicingCriterion;
}

export interface LineageQueryResult extends BaseQueryResult {
	/** Maps each criterion to the found lineage, duplicates are ignored. */
	readonly lineages: Record<SingleSlicingCriterion, Set<NodeId>>;
}

export const LineageQueryDefinition = {
	executor:        executeLineageQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'lineage'>['lineage'];
		result.push(`Query: ${bold('lineage', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [criteria, lineage] of Object.entries(out.lineages)) {
			result.push(`   ╰ ${criteria}: {${summarizeIdsIfTooLong(formatter, [...lineage])}}`);
		}
		return true;
	},
	schema: Joi.object({
		type:      Joi.string().valid('lineage').required().description('The type of the query.'),
		criterion: Joi.string().required().description('The slicing criterion of the node to get the lineage of.')
	}).description('Lineage query used to find the lineage of a node in the dataflow graph')
} as const satisfies SupportedQuery<'lineage'>;
