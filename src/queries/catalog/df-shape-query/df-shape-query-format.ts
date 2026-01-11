import Joi from 'joi';
import type { DataFrameDomain, DataFrameStateDomain } from '../../../abstract-interpretation/data-frame/dataframe-domain';
import { StateAbstractDomain } from '../../../abstract-interpretation/domains/state-abstract-domain';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import { sliceCriterionParser } from '../../../cli/repl/parser/slice-query-parser';
import type { FlowrConfigOptions } from '../../../config';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { executeDfShapeQuery } from './df-shape-query-executor';

/** Infer the shape of data frames using abstract interpretation. */
export interface DfShapeQuery extends BaseQueryFormat {
	readonly type:       'df-shape';
	readonly criterion?: SingleSlicingCriterion;
}

export interface DfShapeQueryResult extends BaseQueryResult {
	domains: DataFrameStateDomain | Map<SingleSlicingCriterion, DataFrameDomain | undefined>
}

function dfShapeQueryLineParser(_output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'df-shape'> {
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
		const domains = out.domains instanceof StateAbstractDomain ? out.domains.value : out.domains;
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
		const { domains, ...out } = queryResults as QueryResults<'df-shape'>['df-shape'];
		const state = domains instanceof StateAbstractDomain ? domains.value : domains;
		const json = Object.fromEntries(state.entries().map(([key, domain]) => [key, domain?.toJson() ?? null]));
		const result = { domains: json, ...out } as object;

		return result;
	},
	fromLine: dfShapeQueryLineParser,
	schema:   Joi.object({
		type:      Joi.string().valid('df-shape').required().description('The type of the query.'),
		criterion: Joi.string().optional().description('The slicing criterion of the node to get the dataframe shape for.')
	}).description('The df-shape query retrieves information on the shape of dataframes'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'df-shape'>;
