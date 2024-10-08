import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';

/**
 * Simple re-returns the normalized AST of the analysis.
 */
export interface NormalizedAstQuery extends BaseQueryFormat {
	readonly type: 'normalized-ast';
}

export interface NormalizedAstQueryResult extends BaseQueryResult {
	readonly normalized: NormalizedAst;
}
