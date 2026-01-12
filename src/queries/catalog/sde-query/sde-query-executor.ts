import type { SdeQuery, SdeQueryResult } from './sde-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import type { Lift, Value } from '../../../abstract-interpretation/eval/domain';
import { Top } from '../../../abstract-interpretation/eval/domain';
import type { ResolveResult } from '../../../dataflow/eval/resolve/alias-tracking';
import { resolveIdToValue } from '../../../dataflow/eval/resolve/alias-tracking';
import { isValue } from '../../../dataflow/eval/values/r-value';
import { unescapeSpecialChars } from '../../../abstract-interpretation/data-frame/resolve-args';
import type { RStringValue } from '../../../r-bridge/lang-4.x/convert-values';
import type { ConstSet } from '../../../abstract-interpretation/eval/domains/constant-set';

export function fingerPrintOfQuery(query: SdeQuery): string {
	return JSON.stringify(query);
}

export function executeSdeQuery({ ast, config, dataflow }: BasicQueryData, queries: readonly SdeQuery[]): SdeQueryResult {
	const start = Date.now();
	const results = new Map<SingleSlicingCriterion, Lift<Value>>();

	for(const query of queries) {
		for(const criterion of query.criteria) {
			if(results.has(criterion)) {
				log.warn('Duplicate criterion in string domain query:', criterion);
				continue;
			}
			
			const nodeId = slicingCriterionToId(criterion, ast.idMap);
			let value = ast.idMap.get(nodeId)?.info.sdvalue as Lift<Value> | undefined;
			if(config.abstractInterpretation.string.enable) {
				value ??= Top;
			} else {
				const resolved = resolveIdToValue(nodeId, {
					resolve: config.solver.variables,
					full:    true,
					idMap:   ast.idMap,
					graph:   dataflow.graph,
				});
				value ??= resolveResultToConstSet(resolved);
			}
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

function resolveResultToConstSet(resolved: ResolveResult): Lift<Value> {
	if(resolved.type !== 'set') {
		return Top;
	}
	if(!resolved.elements.every(it => isValue(it) && it.type === 'string')) {
		return Top;
	}
	const elements = resolved.elements;
	if(!elements.every(it => isValue(it.value))) {
		return Top;
	}
	const values = elements.map(it => it.value as RStringValue);
	const value: ConstSet = {
		kind:  'const-set',
		value: values.map(it => unescapeSpecialChars(it.str))
	};
	return value;
}
