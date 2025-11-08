import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold, ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { executeLineageQuery } from './lineage-query-executor';
import { summarizeIdsIfTooLong } from '../../query-print';
import { sliceCriterionParser } from '../../../cli/repl/parser/slice-query-parser';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfigOptions } from '../../../config';

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

function lineageQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'lineage'> {
	const criterion = sliceCriterionParser(line[0]);

	if(!criterion) {
		output.stderr(output.formatter.format('Invalid lineage query format, slicing criterion must be given in parentheses, e.g. (2@var), (1:5) or ($10)',
			{ color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}

	return {
		query: {
			type:      'lineage',
			criterion: criterion
		},
		rCode: line[1]
	};
}

export const LineageQueryDefinition = {
	executor:        executeLineageQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'lineage'>['lineage'];
		result.push(`Query: ${bold('lineage', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [criteria, lineage] of Object.entries(out.lineages)) {
			result.push(`   ╰ ${criteria}: {${summarizeIdsIfTooLong(formatter, [...lineage])}}`);
		}
		return true;
	},
	fromLine: lineageQueryLineParser,
	schema:   Joi.object({
		type:      Joi.string().valid('lineage').required().description('The type of the query.'),
		criterion: Joi.string().required().description('The slicing criterion of the node to get the lineage of.')
	}).description('Lineage query used to find the lineage of a node in the dataflow graph'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'lineage'>['lineage'];
		return Object.values(out.lineages).flatMap(lineage => [...lineage]);
	}
} as const satisfies SupportedQuery<'lineage'>;
