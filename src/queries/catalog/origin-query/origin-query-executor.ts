import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import type { OriginQueryResult, OriginQuery } from './origin-query-format';
import { getOriginInDfg } from '../../../dataflow/origin/dfg-get-origin';

export function fingerPrintOfQuery(query: OriginQuery): SingleSlicingCriterion {
	return query.criterion;
}

export function executeResolveValueQuery({ dataflow: { graph }, ast }: BasicQueryData, queries: readonly OriginQuery[]): OriginQueryResult {
	const start = Date.now();
	const results: OriginQueryResult['results'] = {};
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);
		
		if(results[key]) {
			log.warn(`Duplicate Key for origin-query: ${key}, skipping...`);
		}

		const astId = slicingCriterionToId(key, ast.idMap);
		if(astId === undefined) {
			log.warn(`Could not resolve id for ${key}, skipping...`);
			continue;
		}
		results[key] = getOriginInDfg(graph, astId);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
