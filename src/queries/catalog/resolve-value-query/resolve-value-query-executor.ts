import type { ResolveValueQuery, ResolveValueQueryResult } from './resolve-value-query-format';
import { staticSlicing } from '../../../slicing/static/static-slicer';
import { reconstructToCode } from '../../../reconstruct/reconstruct';
import { doNotAutoSelect } from '../../../reconstruct/auto-select/auto-select-defaults';
import { makeMagicCommentHandler } from '../../../reconstruct/auto-select/magic-comments';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import { resolveToValues } from '../../../dataflow/environments/resolve-by-name';
import { recoverName } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

export function fingerPrintOfQuery(query: ResolveValueQuery): string {
	return JSON.stringify(query);
}

export function executeResolveValueQuery({ dataflow: { graph, environment }, ast }: BasicQueryData, queries: readonly ResolveValueQuery[]): ResolveValueQueryResult {
	const start = Date.now();
	const results: ResolveValueQueryResult['results'] = [];
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);
		
		if(results[key]) {
			log.warn(`Duplicate Key for slicing-query: ${key}, skipping...`);
		}
		
		const ids = query.criteria.map(criteria => slicingCriterionToId(criteria, graph.idMap!));
		const values = new Set<unknown>();

		const resolveStart = Date.now();
		for(const id of ids) {
			resolveToValues(recoverName(id, graph.idMap),  environment, graph)
			?.forEach(values.add);
		}
		const resolveEnd = Date.now();
		
		results[key] = {
			values: values.values(),
			'.meta': { timing: resolveEnd - resolveStart }
		}
	}
	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
