import { log } from '../../../util/log';
import type { IdMapQuery, IdMapQueryResult } from './id-map-query-format';
import type { BasicQueryData } from '../../base-query-format';

/**
 * Executes the given ID map queries using the provided analyzer.
 */
export async function executeIdMapQuery({ analyzer }: BasicQueryData, queries: readonly IdMapQuery[]): Promise<IdMapQueryResult> {
	if(queries.length !== 1) {
		log.warn('Id-Map query expects only up to one query, but got', queries.length);
	}

	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		idMap: (await analyzer.normalize()).idMap
	};
}
