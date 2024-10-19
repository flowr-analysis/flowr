import type { BasicQueryData } from '../../query';
import { log } from '../../../util/log';
import type {
	LocationMapQuery,
	LocationMapQueryResult
} from './location-map-query-format';


export function executeLocationMapQuery({ ast }: BasicQueryData, queries: readonly LocationMapQuery[]): LocationMapQueryResult {
	if(queries.length !== 1) {
		log.warn('Id-Map query expects only up to one query, but got', queries.length);
	}
	const start = Date.now();
	const locationMap: LocationMapQueryResult['map'] = {};
	for(const [id, node] of ast.idMap.entries()) {
		locationMap[id] = node.location;
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		map: locationMap
	};
}
