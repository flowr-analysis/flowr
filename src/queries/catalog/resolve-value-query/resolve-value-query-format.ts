import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';

import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold, ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { executeResolveValueQuery } from './resolve-value-query-executor';
import { stringifyValue } from '../../../dataflow/eval/values/r-value';
import type { ResolveResult } from '../../../dataflow/eval/resolve/alias-tracking';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfigOptions } from '../../../config';
import { sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';


export interface ResolveValueQuery extends BaseQueryFormat {
	readonly type:     'resolve-value';
	/** The slicing criteria to use */
	readonly criteria: SlicingCriteria,
}

export interface ResolveValueQueryResult extends BaseQueryResult {
	results: Record<string, {values: ResolveResult[]}>
}

function resolveValueLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfigOptions): ParsedQueryLine<'resolve-value'> {
	const criteria = sliceCriteriaParser(line[0]);
	const input = line[1];

	if(!criteria || criteria.length == 0) {
		output.stderr(output.formatter.format('Invalid static-slice query format, slicing criteria must be given in the form "(criterion1;criterion2;...)"',
			{ color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}

	return { query: [
		{
			type:     'resolve-value',
			criteria: criteria,
		}], rCode: input } ;
}

export const ResolveValueQueryDefinition = {
	executor:        executeResolveValueQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'resolve-value'>['resolve-value'];
		result.push(`Query: ${bold('resolve-value', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		for(const [fingerprint, obj] of Object.entries(out.results)) {
			const { criteria } = JSON.parse(fingerprint) as ResolveValueQuery;
			result.push(`   ╰ Values for {${criteria.join(', ')}}`);
			result.push(`   	╰ ${obj.values.map(v => stringifyValue(v)).join(', ')}`);
		}
		return true;
	},
	fromLine: resolveValueLineParser,
	schema:   Joi.object({
		type:     Joi.string().valid('resolve-value').required().description('The type of the query.'),
		criteria: Joi.array().items(Joi.string()).min(1).required().description('The slicing criteria to use.'),
	}).description('The resolve value query used to get definitions of an identifier'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'resolve-value'>;
