import type { ArgProps, CallProps } from '../dataflow/environments/built-in-props';
import { ArgProp, CallProp } from '../dataflow/environments/built-in-props';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import type { TaintConditionFunction, TaintMapping } from './taint-mapping';
import { TaintRole } from './taint-mapping';
import { Top } from '../abstract-interpretation/domains/lattice';
import { taintMappingFromBuiltInIndex } from './builtin-index-bridge';

export type TaintArgSelector = {
	/** Argument properties of the function category */
	argProps:     ArgProps,
	/**
	 * How many arguments are of interest
	 * - ExactlyOne: The matching functions need to have exactly one argument fulfilling the {@link TaintArgSelector.argProps}
	 * - AtLeastOne: The matching functions should have at least one argument fulfilling the {@link TaintArgSelector.argProps}
	 */
	argSelection: 'ExactlyOne' | 'AtLeastOne',
};

export type TaintFnCategory = {
	/** Role the functions of the category should get assigned to */
	role:      TaintRole,
	/** Call properties of the function category */
	callProps: CallProps,
	/** Argument properties of the function category */
	args:      TaintArgSelector,
	/** Handler describing the calculation of the resulting taint */
	handler:   TaintConditionFunction<AnyAbstractDomain>
};

export const TaintFnCategory: Record<'pureAlias' | 'pureComputer' | 'pureShape', TaintFnCategory> = {
	/** Pure functions which return a single one of their arguments unchanged */
	pureAlias: {
		role:      TaintRole.Transformer,
		callProps: CallProp.Pure,
		args:      {
			argProps:     ArgProp.Alias,
			argSelection: 'ExactlyOne',
		},
		/** Pass through of incoming taint */
		handler: ([_arg], [taint]) => taint.value
	},
	/** Pure functions which calculate their result on one or multiple arguments */
	pureComputer: {
		role:      TaintRole.Transformer,
		callProps: CallProp.Pure,
		args:      {
			argProps:     ArgProp.Value,
			argSelection: 'AtLeastOne',
		},
		/** Least-upper bound of incoming taints */
		handler: ([_arg], taints) =>
			taints.length > 0 ? AbstractDomain.joinAll(taints).value : Top
	},
	/** Pure functions which calculate their result based on the shape of input data */
	pureShape: {
		role:      TaintRole.Transformer,
		callProps: CallProp.Pure,
		args:      {
			argProps:     ArgProp.Shape,
			argSelection: 'AtLeastOne',
		},
		/** Least-upper bound of incoming taints */
		handler: ([_arg], taints) =>
			taints.length > 0 ? AbstractDomain.joinAll(taints).value : Top
	}
};

/**
 * Get the set of taint mappings for a given {@link TaintFnCategory}.
 */
export function resolveCategoryToTaintMappings<Domain extends AnyAbstractDomain>(category: TaintFnCategory): TaintMapping<Domain>[] {
	const mappings = taintMappingFromBuiltInIndex(category.callProps, category.args.argProps, category.handler)
		.map(m => {
			return { role: category.role, ...m };
		});

	if(category.args.argSelection === 'ExactlyOne') {
		return mappings.filter(m => m.condition.argTaints?.length === 1);
	}

	return mappings;
}
