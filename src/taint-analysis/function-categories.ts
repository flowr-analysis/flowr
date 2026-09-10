import type { ArgProps, CallProps } from '../dataflow/environments/built-in-props';
import { ArgProp, CallProp } from '../dataflow/environments/built-in-props';
import { BuiltInIndex } from '../dataflow/environments/query-fn-props';
import type { TaintConditionFunction, TaintMapper, TaintMapping, TaintParameterLocation } from './function-mapper';
import { TaintRole } from './function-mapper';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { isNotUndefined } from '../util/assert';
import type { Identifier } from '../dataflow/environments/identifier';

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
	role:           TaintRole,
	/** Call properties of the function category */
	callProps:      CallProps,
	/** Argument properties of the function category */
	args:           TaintArgSelector,
	/** Default handler describing the calculation of the resulting taint */
	defaultHandler: TaintConditionFunction<AnyAbstractDomain>
};

export const TaintFnCategory: Record<'pureAlias' | 'pureComputer', TaintFnCategory> = {
	/** Pure functions which return a single one of their arguments unchanged */
	pureAlias: {
		role:      TaintRole.Transformer,
		callProps: CallProp.Pure,
		args:      {
			argProps:     ArgProp.Alias,
			argSelection: 'ExactlyOne',
		},
		/** Pass through of incoming taint */
		defaultHandler: ([_arg], [taint]) => taint.value
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
		defaultHandler: ([_arg], taints) => taints.length > 0 ? AbstractDomain.joinAll(taints).value : undefined
	}
};

/**
 *
 */
export function resolveCategoryToTaintMappings<Domain extends AnyAbstractDomain>(category: TaintFnCategory, handler?: TaintConditionFunction<AnyAbstractDomain>): TaintMapper<Domain> {
	const idx = BuiltInIndex.default();
	const mappings: (TaintMapping<Domain> | undefined)[] = idx.withAll(category.callProps).map(i => {
		const relevantArgs = getRelevantArg(i, category.args);
		return relevantArgs ?
			{
				role:       category.role,
				identifier: i,
				condition:  {
					argTaints:   relevantArgs,
					conditionFn: handler ?? category.defaultHandler
				}
			} : undefined;
	});
	return mappings.filter(isNotUndefined);
}

function getRelevantArg(ident: Identifier, argCategory: TaintArgSelector): TaintParameterLocation[] | undefined {
	const sig = BuiltInIndex.default().get(ident)?.sig;
	if(!sig) {
		return undefined;
	}

	const args = sig.map((arg, pos) => {
		return { pos, arg };
	});

	const relevantArgs = args
		.filter(({ arg: [_name, props] }) => (props & argCategory.argProps) !== 0);

	if(relevantArgs.length === 0) {
		return undefined;
	}

	if(argCategory.argSelection === 'ExactlyOne') {
		if(relevantArgs.length !== 1) {
			return undefined;
		}

		const relevantArg = relevantArgs[0];
		return [{ pos: relevantArg.pos, name: relevantArg.arg[0] }];
	}

	return relevantArgs.map((arg) => {
		return { pos: arg.pos, name: arg.arg[0] };
	});
}
