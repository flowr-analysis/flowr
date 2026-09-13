import { BuiltInIndex } from '../dataflow/environments/query-fn-props';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { PropSelector, ArgProp  } from '../dataflow/environments/built-in-props';
import type { TaintConditionFunction, TaintMapping } from './taint-mapping';
import { isNotUndefined } from '../util/assert';

/**
 *
 */
export function taintMappingFromBuiltInIndex<Domain extends AnyAbstractDomain>(props: PropSelector, argProps: ArgProp, conditionFn: TaintConditionFunction<Domain>): TaintMapping<Domain>[] {
	const identifiers = BuiltInIndex.default().with(props);
	const mappings = identifiers.map(i => {
		const sig = BuiltInIndex.default().get(i)?.sig;
		if(!sig) {
			return undefined;
		}

		const relevantArgs = sig
			.map(([name, p], index) => (p & argProps) !== 0 ? { pos: index, name } : undefined)
			.filter(isNotUndefined);

		if(relevantArgs.length === 0) {
			return undefined;
		}

		// Watch every matching argument, so a call with more than one resource/injectable argument
		// (e.g. download.file(url, destfile), system2(command, args)) is a sink whenever any of them is tainted.
		const mapping = {
			identifier: i,
			condition:  {
				argTaints: relevantArgs,
				conditionFn
			}
		} as TaintMapping<Domain>;

		return mapping;
	});

	return mappings.filter(isNotUndefined);
}
