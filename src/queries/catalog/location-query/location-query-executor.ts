import type { BasicQueryData } from '../../query';
import type { LocationQuery, LocationQueryResult } from './location-query-format';


export function executeLocationQuery({ ast }: BasicQueryData, queries: readonly LocationQuery[]): LocationQueryResult {
	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		location: Object.fromEntries(queries.map(({ nodeId }) => [nodeId, ast.idMap.get(nodeId)?.location]))
	};
}
