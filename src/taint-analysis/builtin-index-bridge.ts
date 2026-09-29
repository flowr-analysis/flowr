import { BuiltInIndex } from '../dataflow/environments/query-fn-props';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { ArgProp, PropSelector } from '../dataflow/environments/built-in-props';
import type { TaintConditionFunction, TaintConditionMapping } from './taint-mapping';
import { isNotUndefined } from '../util/assert';

/**
 * Creates a taint mapping rule for each function that matches the given {@link PropSelector} and whose signature
 * has at least one parameter fulfilling {@link ArgProp}.
 * @param props - The properties the function has to fulfill
 * @param argProps - The properties at least one argument has to fulfill
 * @param conditionFn - The taint condition function to apply to matching function calls
 */
export function taintMappingFromBuiltInIndex<Domain extends AnyAbstractDomain>(
	props: PropSelector,
	argProps: ArgProp,
	conditionFn: TaintConditionFunction<Domain>): TaintConditionMapping<Domain>[] {
	const identifiers = BuiltInIndex.default().with(props);
	const mappings = identifiers.map(i => {
		const sig = BuiltInIndex.default().get(i)?.sig;
		if(!sig || !sig.some(([, p]) => (p & argProps) !== 0)) {
			return undefined;
		}

		return {
			identifier: i,
			condition:  {
				argSignature: { sig, props: argProps },
				conditionFn
			}
		};
	});

	return mappings.filter(isNotUndefined);
}
