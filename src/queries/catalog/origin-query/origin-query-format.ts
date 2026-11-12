import { type BasicQueryData, type BaseQueryFormat, type BaseQueryResult, invalidQueryLine } from '../../base-query-format';
import { queryHeader } from '../../query-print';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import Joi from 'joi';
import type { Origin } from '../../../dataflow/origin/dfg-get-origin';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { criteriaQueryCompleter, queryLineCode, sliceCriterionParser } from '../../../cli/repl/parser/slice-query-parser';
import { log } from '../../../util/log';
import { metaSince } from '../../query-meta';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { Dataflow } from '../../../dataflow/graph/df-helper';

/**
 * Execute origin queries, catching duplicates with the same fingerprint
 */
export async function executeOriginQuery({ analyzer }: BasicQueryData, queries: readonly OriginQuery[]): Promise<OriginQueryResult> {
	const start = Date.now();
	const results: OriginQueryResult['results'] = {};
	for(const query of queries) {
		const key = query.criterion;

		if(results[key]) {
			log.warn(`Duplicate Key for origin-query: ${key}, skipping...`);
		}

		const astId = SlicingCriterion.tryParse(key, (await analyzer.normalize()).idMap);
		if(astId === undefined) {
			log.warn(`Could not resolve id for ${key}, skipping...`);
			continue;
		}
		results[key] = Dataflow.origin((await analyzer.dataflow()).graph, astId);
	}

	return {
		...metaSince(start),
		results
	};
}


export interface OriginQuery extends BaseQueryFormat {
	readonly type:      'origin';
	/** The slicing criteria to use */
	readonly criterion: SlicingCriterion,
}

export interface OriginQueryResult extends BaseQueryResult {
	results: Record<SlicingCriterion, Origin[] | undefined>
}

function originQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'origin'> {
	const criterion = sliceCriterionParser(line[0]);

	if(!criterion) {
		return invalidQueryLine(output, 'Invalid origin query format, slicing criterion must be given in parentheses, e.g. (2@var), (1:5) or ($10)');
	}

	return {
		query: {
			type:      'origin',
			criterion: criterion
		},
		rCode: queryLineCode(line)
	};
}


export const OriginQueryDefinition = {
	title:           'Origin Query',
	executor:        executeOriginQuery,
	perQueryResults: true,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'origin'>['origin'];
		result.push(queryHeader('origin', formatter, out['.meta'].timing));
		for(const [criteria, obj] of Object.entries(out.results)) {
			result.push(`   ╰ Origins for {${criteria}}`);
			result.push(`     ╰ ${obj?.map(o => JSON.stringify(o)).join(', ')}`);
		}
		return true;
	},
	fromLine:  originQueryLineParser,
	completer: criteriaQueryCompleter,
	syntax:    '@origin (<criterion>) <code | file://path>',
	schema:    Joi.object({
		type:      Joi.string().valid('origin').required().description('The type of the query.'),
		criterion: Joi.string().required().description('The slicing criteria to use'),
	}).description('The resolve value query used to get definitions of an identifier'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'origin'>['origin'];
		return Object.entries(out.results).flatMap(([_, obj]) => obj?.map(origin => origin.id) ?? []);
	}
} as const satisfies SupportedQuery<'origin'>;
