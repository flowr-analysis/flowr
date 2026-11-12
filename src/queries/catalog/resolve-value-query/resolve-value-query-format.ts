import { type BasicQueryData, type BaseQueryFormat, type BaseQueryResult, invalidQueryLine } from '../../base-query-format';
import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import { queryHeader } from '../../query-print';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import Joi from 'joi';
import { stringifyValue } from '../../../dataflow/eval/values/r-value';
import type { ResolveResult } from '../../../dataflow/eval/resolve/alias-tracking';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { criteriaQueryCompleter, queryLineCode, sliceCriteriaParser } from '../../../cli/repl/parser/slice-query-parser';
import { log } from '../../../util/log';
import { metaSince } from '../../query-meta';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { Resolve } from '../../../dataflow/environments/resolve-helper';


/**
 * Naive fingerprint to filter out duplicate queries.
 */
export function fingerPrintOfQuery(query: ResolveValueQuery): string {
	return JSON.stringify(query);
}


/**
 * Executes a resolve-value query.
 */
export async function executeResolveValueQuery({ analyzer }: BasicQueryData, queries: readonly ResolveValueQuery[]): Promise<ResolveValueQueryResult> {
	const start = Date.now();
	const results: ResolveValueQueryResult['results'] = {};

	const graph = (await analyzer.dataflow()).graph;
	const idMap = (await analyzer.normalize()).idMap;
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);

		if(results[key]) {
			log.warn(`Duplicate Key for resolve-value-query: ${key}, skipping...`);
		}

		const values = query.criteria
			.map(criteria => SlicingCriterion.parse(criteria, idMap))
			.flatMap(ident => Resolve.toValue(ident, { graph, full: true, idMap, resolve: analyzer.flowrConfig.solver.variables, ctx: analyzer.inspectContext() }));

		results[key] = {
			values: values
		};
	}

	return {
		...metaSince(start),
		results
	};
}


export interface ResolveValueQuery extends BaseQueryFormat {
	readonly type:     'resolve-value';
	/** The slicing criteria to use */
	readonly criteria: SlicingCriteria,
}

export interface ResolveValueQueryResult extends BaseQueryResult {
	results: Record<string, { values: ResolveResult[] }>
}

function resolveValueLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'resolve-value'> {
	const criteria = sliceCriteriaParser(line[0]);
	if(!criteria || criteria.length == 0) {
		return invalidQueryLine(output, 'Invalid resolve-value query format, slicing criteria must be given in the form "(criterion1;criterion2;...)"');
	}

	return {
		query: [
			{
				type:     'resolve-value',
				criteria: criteria,
			}],
		rCode: queryLineCode(line)
	};
}

export const ResolveValueQueryDefinition = {
	title:           'Resolve Value Query',
	executor:        executeResolveValueQuery,
	perQueryResults: true,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'resolve-value'>['resolve-value'];
		if(out === undefined || typeof out !== 'object' || !('.meta' in out)) {
			result.push(
				formatter.format('Resolve value failed (maybe your criterion does not exist?)!', { color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }),
			);
			return true;
		}
		result.push(queryHeader('resolve-value', formatter, out['.meta'].timing));
		for(const [fingerprint, obj] of Object.entries(out.results)) {
			const { criteria } = JSON.parse(fingerprint) as ResolveValueQuery;
			result.push(`   ╰ Values for {${criteria.join(', ')}}`);
			result.push(`     ╰ ${obj.values.map(v => stringifyValue(v)).join(', ')}`);
		}
		return true;
	},
	fromLine:  resolveValueLineParser,
	completer: criteriaQueryCompleter,
	syntax:    '@resolve-value (<crit>;...) <code | file://path>',
	schema:    Joi.object({
		type:     Joi.string().valid('resolve-value').required().description('The type of the query.'),
		criteria: Joi.array().items(Joi.string()).min(1).required().description('The slicing criteria to use.'),
	}).description('The resolve value query used to get definitions of an identifier')
} as const satisfies SupportedQuery<'resolve-value'>;
