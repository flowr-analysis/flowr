import type { DataFrameDomain } from '../../../abstract-interpretation/data-frame/dataframe-domain';
import { DataFrameStateDomain } from '../../../abstract-interpretation/data-frame/dataframe-domain';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { executeDfShapeQuery } from './df-shape-query-executor';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfigOptions } from '../../../config';
import { sliceCriterionParser } from '../../../cli/repl/parser/slice-query-parser';
import Joi from 'joi';

/** Infer the shape of data frames using abstract interpretation. */
export interface DfShapeQuery extends BaseQueryFormat {
	readonly type:       'df-shape';
	readonly criterion?: SingleSlicingCriterion;
}

export interface DfShapeQueryResult extends BaseQueryResult {
	domains: DataFrameStateDomain | Map<SingleSlicingCriterion, DataFrameDomain | undefined>
}

function dfShapeQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'df-shape'> {
	const criterion = sliceCriterionParser(line[0]);

	return {
		query: {
			type:      'df-shape',
			criterion: criterion
		},
		rCode: criterion ? line[1] : line[0]
	};
}

export const DfShapeQueryDefinition = {
	executor:        executeDfShapeQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'df-shape'>['df-shape'];
		const domains = out.domains instanceof DataFrameStateDomain ? out.domains.value : out.domains;
		result.push(`Query: ${bold('df-shape', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(...domains.entries().take(20).map(([key, domain]) => {
			return `   ╰ ${key}: ${domain?.toString()}`;
		}));
		if(domains.size > 20) {
			result.push('   ╰ ... (see JSON)');
		}
		return true;
	},
	jsonFormatter: (queryResults: BaseQueryResult) => {
		const out = queryResults as QueryResults<'df-shape'>['df-shape'];
		const domains = out.domains instanceof DataFrameStateDomain ? out.domains.value : out.domains;
		const json = Object.fromEntries(domains.entries().map(([key, domain]) => [key, domain?.toJson()])) as object;

		return json;
	},
	fromLine: dfShapeQueryLineParser,
	schema:   Joi.object({
		type:      Joi.string().valid('df-shape').required().description('The type of the query.'),
		criterion: Joi.string().optional().description('The slicing criterion of the node to get the dataframe shape for.')
	}).description('The df-shape query retrieves information on the shape of dataframes'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'df-shape'>;
