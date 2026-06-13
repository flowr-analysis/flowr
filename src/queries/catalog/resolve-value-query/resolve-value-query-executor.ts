import type { ResolveValueQuery, ResolveValueQueryResult } from './resolve-value-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { resolveIdToValue } from '../../../dataflow/eval/resolve/alias-tracking';
import { SlicingCriterion } from '../../../slicing/criterion/parse';


/**
 * Naive fingerprint to filter out duplicate queries.
 */
export function fingerPrintOfQuery(query: ResolveValueQuery): string {
	return JSON.stringify(query);
}


/**
 * Executes a resolve-value query.
 */
export async function executeResolveValueQuery({ analyzer }: BasicQueryData, queries: readonly ResolveValueQuery[]): Promise<ResolveValueQueryResult> {
	const start = Date.now();
	const results: ResolveValueQueryResult['results'] = {};

	const graph = (await analyzer.dataflow()).graph;
	const idMap = (await analyzer.normalize()).idMap;
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);

		if(results[key]) {
			log.warn(`Duplicate Key for resolve-value-query: ${key}, skipping...`);
		}

		const values = query.criteria
			.map(criteria => SlicingCriterion.parse(criteria, idMap))
			.flatMap(ident => resolveIdToValue(ident, { graph, full: true, idMap, resolve: analyzer.flowrConfig.solver.variables, ctx: analyzer.inspectContext() }));

		results[key] = {
			values: values
		};
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
