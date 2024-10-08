import type { BasicQueryData } from '../../query';
import { log } from '../../../util/log';
import type { IdMapQuery, IdMapQueryResult } from './id-map-query-format';
import { guard } from '../../../util/assert';


export function executeIdMapQuery({ graph }: BasicQueryData, queries: readonly IdMapQuery[]): IdMapQueryResult {
	if(queries.length !== 1) {
		log.warn('Id-Map query expects only up to one query, but got', queries.length);
	}

	guard(graph.idMap !== undefined, 'The idMap is missing from the dataflow graph');

	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		idMap: graph.idMap
	};
}
