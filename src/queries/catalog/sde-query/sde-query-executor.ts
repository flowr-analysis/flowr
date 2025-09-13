import type { SdeQuery, SdeQueryResult } from './sde-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { SingleSlicingCriterion, slicingCriterionToId } from '../../../slicing/criterion/parse';
import { inferStringDomains } from '../../../abstract-interpretation/eval/inference';
import { extractCfg } from '../../../control-flow/extract-cfg';
import { Bottom, SDValue, Top } from '../../../abstract-interpretation/eval/domain';
import { ConstSet } from '../../../abstract-interpretation/eval/domains/constant-set';
import { resolveIdToValue, ResolveResult } from '../../../dataflow/eval/resolve/alias-tracking';
import { isTop, isBottom, isValue, ValueSet } from '../../../dataflow/eval/values/r-value';

export function fingerPrintOfQuery(query: SdeQuery): string {
	return JSON.stringify(query);
}

export function executeSdeQuery({ dataflow: { graph }, ast, config }: BasicQueryData, queries: readonly SdeQuery[]): SdeQueryResult {
	const start = Date.now();
	const cfg = extractCfg(ast, config, graph);
	inferStringDomains(cfg, graph, ast, config);
	const results = new Map<SingleSlicingCriterion, SDValue | undefined>();

	for(const query of queries) {
		for (const criterion of query.criteria) {
			if(results.has(criterion)) {
				log.warn('Duplicate criterion in string domain query:', criterion);
				continue;
			}
			
			const nodeId = slicingCriterionToId(criterion, ast.idMap);
			const node = ast.idMap.get(nodeId);
			const sdvalue = node?.info.sdvalue as (SDValue | undefined);
			if (sdvalue) {
				results.set(criterion, sdvalue);
			} else {
				const result = resolveIdToValue(nodeId, { graph, full: true, idMap: ast.idMap, resolve: config.solver.variables });				
				const sdresult = resolveResultToSDValue(result);
				results.set(criterion, sdresult);
			}
		}
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results,
	};
}

function resolveResultToSDValue(result: ResolveResult): SDValue {
	if (isTop(result)) {
		return Top;
	} else if (isBottom(result)) {
		return Bottom;
	} else if (isValue<ValueSet>(result)) {
		let tmp: ConstSet = { kind: "const-set", value: [] };
		for (const value of result.elements) {
			if (isTop(value)) {
				return Top;
			} else if (isBottom(value)) {
				return Bottom;
			} else if (value.type === "string" && isValue(value.value)) {
				tmp.value.push(value.value.str)
			} else {
				return Top;
			}
		}

		return tmp;
	} else {
		return Top;
	}
}
