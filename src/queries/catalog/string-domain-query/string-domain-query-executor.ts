import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { extractCfg } from '../../../control-flow/extract-cfg';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import type { StringDomainQuery, StringDomainQueryResult } from './string-domain-query-format';
import { inferStringDomains } from '../../../abstract-interpretation/eval/inference';
import type { Lift, Value } from '../../../abstract-interpretation/eval/domain';

export function executeStringDomainQuery({ dataflow: { graph }, ast, config }: BasicQueryData, queries: readonly StringDomainQuery[]): StringDomainQueryResult {
	const start = Date.now();
	const cfg = extractCfg(ast, config, graph);
	const values = inferStringDomains(cfg, graph, ast, config);
	const result = new Map<SingleSlicingCriterion, Lift<Value> | undefined>();

	for(const query of queries) {
		if(result.has(query.criterion)) {
			log.warn('Duplicate criterion in string domain query:', query.criterion);
			continue;
		}
		const nodeId = slicingCriterionToId(query.criterion, ast.idMap);
		result.set(query.criterion, values.get(nodeId))
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		stringDomainValues: result,
	};
}
