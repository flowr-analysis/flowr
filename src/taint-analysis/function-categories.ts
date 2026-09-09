import type { ArgProps, CallProps } from '../dataflow/environments/built-in-props';
import { ArgProp, CallProp } from '../dataflow/environments/built-in-props';
import { BuiltInIndex } from '../dataflow/environments/query-fn-props';
import type {
	TaintConditionFunction,
	TaintMapper,
	TaintMapping,
	TaintParameterLocation,
	TaintRole
} from './function-mapper';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { isNotUndefined } from '../util/assert';
import type { Identifier } from '../dataflow/environments/identifier';

export type TaintFnCategory = {
	callProps:      CallProps,
	argProps:       ArgProps,
	role:           TaintRole,
	defaultHandler: TaintConditionFunction<AnyAbstractDomain>
};

export const TaintFnCategory = {
	/** Pure functions which return a single one of their arguments unchanged */
	pureAlias: {
		callProps:      CallProp.Pure,
		argProps:       ArgProp.Alias,
		role:           'Transformer',
		defaultHandler: ([_arg], [taint]) => taint
	},
	/** Pure functions which calculate their result on a single argument */
	pureComputer: {
		callProps:      CallProp.Pure,
		argProps:       ArgProp.Value,
		role:           'Transformer',
		defaultHandler: ([_arg], [taint]) => taint
	}
} as Record<'pureAlias' | 'pureComputer', TaintFnCategory>;

/**
 *
 */
export function resolveCategoryToTaintMappings<Domain extends AnyAbstractDomain>(category: TaintFnCategory, handler?: TaintConditionFunction<AnyAbstractDomain>): TaintMapper<Domain> {
	const idx = BuiltInIndex.default();
	const mappings: (TaintMapping<Domain> | undefined)[] = idx.withAll(category.callProps).map(i => {
		const relevantArg = getRelevantArg(i, category.argProps);
		return relevantArg ?
			{
				role:       category.role,
				identifier: i,
				condition:  {
					argTaints:   [relevantArg],
					conditionFn: handler ?? category.defaultHandler
				}
			} : undefined;
	});
	return mappings.filter(isNotUndefined);
}

function getRelevantArg(ident: Identifier, argProps: ArgProps): TaintParameterLocation | undefined {
	const sig = BuiltInIndex.default().get(ident)?.sig;
	if(!sig) {
		return undefined;
	}

	const args = sig.map((arg, pos) => {
		return { pos, arg };
	});

	const relevantArgs = args
		.filter(({ arg: [_name, props] }) => (props & argProps) !== 0);

	if(relevantArgs.length !== 1) {
		return undefined;
	}

	const relevantArg = relevantArgs[0];
	return { pos: relevantArg.pos, name: relevantArg.arg[0] };
}
