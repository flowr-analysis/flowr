import { BuiltInIndex } from '../dataflow/environments/query-fn-props';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { ArgProp, PropSelector } from '../dataflow/environments/built-in-props';
import type { TaintConditionFunction, TaintConditionMapping } from './taint-mapping';
import { isNotUndefined } from '../util/assert';
import type { Identifier } from '../dataflow/environments/identifier';

/**
 * Creates a taint mapping rule for each function that matches the given {@link PropSelector}
 * and has at least one argument fulfilling {@link ArgProp}.
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
		const relevantArgs = getArgs(i, argProps);
		if(!relevantArgs) {
			return undefined;
		}

		return {
			identifier: i,
			condition:  {
				argTaints: relevantArgs,
				conditionFn
			}
		};
	});

	return mappings.filter(isNotUndefined);
}

/**
 * Gets the arguments of the given identifier that match the given {@link ArgProp}.
 */
function getArgs(identifier: Identifier, argProps: ArgProp) {
	const sig = BuiltInIndex.default().get(identifier)?.sig;
	if(!sig) {
		return undefined;
	}

	const relevantArgs = sig
		.map(([name, p], index) => (p & argProps) !== 0 ? { pos: index, name } : undefined)
		.filter(isNotUndefined);

	if(relevantArgs.length === 0) {
		return undefined;
	}

	return relevantArgs;
}