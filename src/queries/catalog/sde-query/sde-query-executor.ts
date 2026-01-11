import type { SdeQuery, SdeQueryResult } from './sde-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import type { Lift, Value } from '../../../abstract-interpretation/eval/domain';
import { Top } from '../../../abstract-interpretation/eval/domain';

export function fingerPrintOfQuery(query: SdeQuery): string {
	return JSON.stringify(query);
}

export function executeSdeQuery({ ast }: BasicQueryData, queries: readonly SdeQuery[]): SdeQueryResult {
	const start = Date.now();
	const results = new Map<SingleSlicingCriterion, Lift<Value>>();

	for(const query of queries) {
		for(const criterion of query.criteria) {
			if(results.has(criterion)) {
				log.warn('Duplicate criterion in string domain query:', criterion);
				continue;
			}
			
			const nodeId = slicingCriterionToId(criterion, ast.idMap);
			const value = ast.idMap.get(nodeId)?.info.sdvalue as Lift<Value> | undefined ?? Top;
			results.set(criterion, value);
		}
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results,
	};
}
