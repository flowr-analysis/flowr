import type { BasicQueryData } from '../../query';
import type { LocationQuery, LocationQueryResult } from './location-query-format';


export function executeLocationQuery({ graph }: BasicQueryData, queries: readonly LocationQuery[]): LocationQueryResult {
	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		// TODO: add qrouping of locations
		location: queries.map(({ nodeId }) =>  graph.idMap?.get(nodeId)?.location)
	};
}
