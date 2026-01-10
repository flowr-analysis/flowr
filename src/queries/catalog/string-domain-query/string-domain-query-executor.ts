import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import type { StringDomainQuery, StringDomainQueryResult } from './string-domain-query-format';
import type { Lift, Value } from '../../../abstract-interpretation/eval/domain';
import { Top } from '../../../abstract-interpretation/eval/domain';

function fingerPrintOfQuery(query: StringDomainQuery): string {
	return JSON.stringify(query);
}

export function executeStringDomainQuery({ ast }: BasicQueryData, queries: readonly StringDomainQuery[]): StringDomainQueryResult {
	const start = Date.now();
	const results: StringDomainQueryResult['results'] = {};

	for(const query of queries) {
		const key = fingerPrintOfQuery(query);

		if(results[key]) {
			log.warn(`Duplicate key for string-domain-query: ${key}, skipping`);
			continue;
		}

		const vals = query.criteria
			.map(criterion => slicingCriterionToId(criterion, ast.idMap))
			.map(it => ast.idMap.get(it)?.info.sdvalue as Lift<Value> | undefined ?? Top);

		results[key] = {
			values: vals
		};
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results,
	};
}
