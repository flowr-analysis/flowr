import type { SdeQuery, SdeQueryResult } from './sde-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import { inferStringDomains } from '../../../abstract-interpretation/eval/inference';
import { extractCfg } from '../../../control-flow/extract-cfg';
import type { Lift, Value } from '../../../abstract-interpretation/eval/domain';
import { Top } from '../../../abstract-interpretation/eval/domain';

export function fingerPrintOfQuery(query: SdeQuery): string {
	return JSON.stringify(query);
}

export function executeSdeQuery({ dataflow: { graph }, ast, config }: BasicQueryData, queries: readonly SdeQuery[]): SdeQueryResult {
	const start = Date.now();
	const cfg = extractCfg(ast, config, graph);
	const values = inferStringDomains(cfg, graph, ast, config);
	const results = new Map<SingleSlicingCriterion, Lift<Value> | undefined>();

	for(const query of queries) {
		for(const criterion of query.criteria) {
			if(results.has(criterion)) {
				log.warn('Duplicate criterion in string domain query:', criterion);
				continue;
			}
			
			const nodeId = slicingCriterionToId(criterion, ast.idMap);
			const value = values.get(nodeId) ?? Top;
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
