import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { OriginQuery, OriginQueryResult } from './origin-query-format';
import { Dataflow } from '../../../dataflow/graph/df-helper';

/**
 * Execute origin queries, catching duplicates with the same fingerprint
 */
export async function executeOriginQuery({ analyzer }: BasicQueryData, queries: readonly OriginQuery[]): Promise<OriginQueryResult> {
	const start = Date.now();
	const results: OriginQueryResult['results'] = {};
	for(const query of queries) {
		const key = query.criterion;

		if(results[key]) {
			log.warn(`Duplicate Key for origin-query: ${key}, skipping...`);
		}

		const astId = SlicingCriterion.tryParse(key, (await analyzer.normalize()).idMap);
		if(astId === undefined) {
			log.warn(`Could not resolve id for ${key}, skipping...`);
			continue;
		}
		results[key] = Dataflow.origin((await analyzer.dataflow()).graph, astId);
	}

	return {
		...metaSince(start),
		results
	};
}
