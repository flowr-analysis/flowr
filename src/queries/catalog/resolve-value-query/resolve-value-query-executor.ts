import type { ResolveValueQuery, ResolveValueQueryResult } from './resolve-value-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import { resolveIdToValue } from '../../../dataflow/environments/resolve-by-name';

export function fingerPrintOfQuery(query: ResolveValueQuery): string {
	return JSON.stringify(query);
}

export function executeResolveValueQuery({ dataflow: { graph }, ast }: BasicQueryData, queries: readonly ResolveValueQuery[]): ResolveValueQueryResult {
	const start = Date.now();
	const results: ResolveValueQueryResult['results'] = {};
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);
		
		if(results[key]) {
			log.warn(`Duplicate Key for resolve-value-query: ${key}, skipping...`);
		}
		
		const values = query.criteria
			.map(criteria => slicingCriterionToId(criteria, ast.idMap))
			.flatMap(ident => resolveIdToValue(ident, { graph, full: true, idMap: ast.idMap }) ?? []);

		results[key] = {
			values: values ? [... new Set(values)] : []
		};
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
