import { log } from '../../../util/log';
import type { NormalizedAstQuery, NormalizedAstQueryResult } from './normalized-ast-query-format';
import type { BasicQueryData } from '../../base-query-format';



/**
 *
 */
export async function executeNormalizedAstQuery({ analyzer }: BasicQueryData, queries: readonly NormalizedAstQuery[]): Promise<NormalizedAstQueryResult> {
	if(queries.length !== 1) {
		log.warn('Normalized-Ast query expects only up to one query, but got', queries.length);
	}
	const startTime = Date.now();
	const normalized = await analyzer.normalize();
	return {
		'.meta': {
			timing: Date.now() - startTime
		},
		normalized
	};
}
