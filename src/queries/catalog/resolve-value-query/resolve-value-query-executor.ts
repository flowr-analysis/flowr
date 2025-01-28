import type { ResolveValueQuery, ResolveValueQueryResult } from './resolve-value-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import { resolveToValues } from '../../../dataflow/environments/resolve-by-name';
import { recoverName } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

export function fingerPrintOfQuery(query: ResolveValueQuery): string {
	return JSON.stringify(query);
}

export function executeResolveValueQuery({ dataflow: { graph, environment } }: BasicQueryData, queries: readonly ResolveValueQuery[]): ResolveValueQueryResult {
	const idMap = graph.idMap;

	if(!idMap) {
		throw new Error('idMap was undefined');
	}

	const start = Date.now();
	const results: ResolveValueQueryResult['results'] = {};
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);
		
		if(results[key]) {
			log.warn(`Duplicate Key for slicing-query: ${key}, skipping...`);
		}
		
		const values = query.criteria
			.map(criteria => recoverName(slicingCriterionToId(criteria, idMap), idMap))
			.flatMap(ident => resolveToValues(ident, environment, graph));

		results[key] = {
			values: [... new Set(values)]
		};
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
