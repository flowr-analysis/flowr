import type { ResolveValueQuery, ResolveValueQueryResult } from './resolve-value-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import { resolveIdToValue } from '../../../dataflow/eval/resolve/alias-tracking';


/**
 *
 */
export function fingerPrintOfQuery(query: ResolveValueQuery): string {
	return JSON.stringify(query);
}


/**
 *
 */
export async function executeResolveValueQuery({ analyzer }: BasicQueryData, queries: readonly ResolveValueQuery[]): Promise<ResolveValueQueryResult> {
	const start = Date.now();
	const results: ResolveValueQueryResult['results'] = {};

	const graph = (await analyzer.dataflow()).graph;
	const ast = await analyzer.normalize();

	for(const query of queries) {
		const key = fingerPrintOfQuery(query);

		if(results[key]) {
			log.warn(`Duplicate Key for resolve-value-query: ${key}, skipping...`);
		}

		const values = query.criteria
			.map(criteria => slicingCriterionToId(criteria, ast.idMap))
			.flatMap(ident => resolveIdToValue(ident, { graph, full: true, idMap: ast.idMap, resolve: analyzer.flowrConfig.solver.variables }));

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
