import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';

import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';

import { executeResolveValueQuery } from './origin-query-executor';
import type { Origin } from '../../../dataflow/origin/dfg-get-origin';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfigOptions } from '../../../config';
import { sliceQueryParser } from '../../../cli/repl/parser/slice-query-parser';


export interface OriginQuery extends BaseQueryFormat {
	readonly type:      'origin';
	/** The slicing criteria to use */
	readonly criterion: SingleSlicingCriterion,
}

export interface OriginQueryResult extends BaseQueryResult {
	results: Record<SingleSlicingCriterion, Origin[] | undefined>
}

export const OriginQueryDefinition = {
	executor:        executeResolveValueQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'origin'>['origin'];
		result.push(`Query: ${bold('origin', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [criteria, obj] of Object.entries(out.results)) {
			result.push(`   ╰ Origins for {${criteria}}`);
			result.push(`   	╰ ${obj?.map(o => JSON.stringify(o)).join(', ')}`);
		}
		return true;
	},
	fromLine: (output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'origin'> =>
		sliceQueryParser({ type: 'origin', line, output, isMandatory: true }),
	schema: Joi.object({
		type:      Joi.string().valid('origin').required().description('The type of the query.'),
		criterion: Joi.string().required().description('The slicing criteria to use'),
	}).description('The resolve value query used to get definitions of an identifier'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'origin'>['origin'];
		return Object.entries(out.results).flatMap(([_, obj]) => obj?.map(origin => origin.id) ?? []);
	}
} as const satisfies SupportedQuery<'origin'>;
