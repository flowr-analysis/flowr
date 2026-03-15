import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import type { OriginQuery, OriginQueryResult } from './origin-query-format';
import { Dataflow } from '../../../dataflow/graph/df-helper';

/**
 * Produce a fingerprint string for an origin query
 */
export function fingerPrintOfQuery(query: OriginQuery): SingleSlicingCriterion {
	return query.criterion;
}

/**
 * Execute origin queries, catching duplicates with the same fingerprint
 */
export async function executeResolveValueQuery({ analyzer }: BasicQueryData, queries: readonly OriginQuery[]): Promise<OriginQueryResult> {
	const start = Date.now();
	const results: OriginQueryResult['results'] = {};
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);

		if(results[key]) {
			log.warn(`Duplicate Key for origin-query: ${key}, skipping...`);
		}

		const astId = SingleSlicingCriterion.tryParse(key, (await analyzer.normalize()).idMap);
		if(astId === undefined) {
			log.warn(`Could not resolve id for ${key}, skipping...`);
			continue;
		}
		results[key] = Dataflow.origin((await analyzer.dataflow()).graph, astId);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
