import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeNormalizedAstQuery } from './normalized-ast-query-executor';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import { normalizedAstToMermaidUrl } from '../../../util/mermaid/ast';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';

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
	executor:        executeNormalizedAstQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'normalized-ast'>['normalized-ast'];
		result.push(`Query: ${bold('normalized-ast', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		result.push(`   ╰ [Normalized AST](${normalizedAstToMermaidUrl(out.normalized.ast)})`);
		return true;
	},
	schema: Joi.object({
		type: Joi.string().valid('normalized-ast').required().description('The type of the query.'),
	}).description('The normalized AST query simply returns the normalized AST, there is no need to pass it multiple times!'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'normalized-ast'>;
