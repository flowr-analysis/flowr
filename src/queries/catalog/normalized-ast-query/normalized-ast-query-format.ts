import type { BaseQueryFormat, BaseQueryResult, BasicQueryData } from '../../base-query-format';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { queryHeader } from '../../query-print';
import { normalizedAstToMermaidUrl } from '../../../util/mermaid/ast';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { log } from '../../../util/log';
import { metaSince } from '../../query-meta';

/**
 * Executes the normalized-AST query.
 */
export async function executeNormalizedAstQuery({ analyzer }: BasicQueryData, queries: readonly NormalizedAstQuery[]): Promise<NormalizedAstQueryResult> {
	if(queries.length !== 1) {
		log.warn('Normalized-Ast query expects only up to one query, but got', queries.length);
	}
	const startTime = Date.now();
	const normalized = await analyzer.normalize();
	return {
		...metaSince(startTime),
		normalized
	};
}

/**
 * Simple re-returns the normalized AST of the analysis.
 */
export interface NormalizedAstQuery extends BaseQueryFormat {
	readonly type: 'normalized-ast';
}

export interface NormalizedAstQueryResult extends BaseQueryResult {
	readonly normalized: NormalizedAst;
}

export const NormalizedAstQueryDefinition = {
	title:           'Normalized AST Query',
	executor:        executeNormalizedAstQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result) => {
		const out = queryResults as QueryResults<'normalized-ast'>['normalized-ast'];
		result.push(queryHeader('normalized-ast', formatter, out['.meta'].timing));
		result.push(`   ╰ [Normalized AST](${normalizedAstToMermaidUrl(out.normalized.ast)})`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('normalized-ast').required().description('The type of the query.'),
	}).description('The normalized AST query simply returns the normalized AST, there is no need to pass it multiple times!')
} as const satisfies SupportedQuery<'normalized-ast'>;
