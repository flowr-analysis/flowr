import type { BasicQueryData } from '../../query';
import { log } from '../../../util/log';
import type { NormalizedAstQuery, NormalizedAstQueryResult } from './normalized-ast-query-format';


export function executeNormalizedAstQuery({ ast }: BasicQueryData, queries: readonly NormalizedAstQuery[]): NormalizedAstQueryResult {
	if(queries.length !== 1) {
		log.warn('Normalized-Ast query expects only up to one query, but got', queries.length);
	}
	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		normalized: ast
	};
}
