import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { type SingleSlicingCriterion , slicingCriterionToId } from '../../../slicing/criterion/parse';
import type { OriginQuery, OriginQueryResult } from './origin-query-format';
import { getOriginInDfg } from '../../../dataflow/origin/dfg-get-origin';

/**
 *
 */
export function fingerPrintOfQuery(query: OriginQuery): SingleSlicingCriterion {
	return query.criterion;
}

/**
 *
 */
export async function executeResolveValueQuery({ analyzer }: BasicQueryData, queries: readonly OriginQuery[]): Promise<OriginQueryResult> {
	const start = Date.now();
	const results: OriginQueryResult['results'] = {};
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);

		if(results[key]) {
			log.warn(`Duplicate Key for origin-query: ${key}, skipping...`);
		}

		const astId = slicingCriterionToId(key, (await analyzer.normalize()).idMap);
		if(astId === undefined) {
			log.warn(`Could not resolve id for ${key}, skipping...`);
			continue;
		}
		results[key] = getOriginInDfg((await analyzer.dataflow()).graph, astId);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
