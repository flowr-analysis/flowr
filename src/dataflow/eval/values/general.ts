import { intervalFrom } from './intervals/interval-constants';
import { ValueLogicalFalse, ValueLogicalTrue } from './logical/logical-constants';
import type { Lift, Unlift, Value, ValueSet } from './r-value';
import { Bottom, isBottom, isTop, Top } from './r-value';
import { stringFrom } from './string/string-constants';

/**
 * Takes n potentially lifted ops and returns `Top` or `Bottom` if any is `Top` or `Bottom`.
 */
export function bottomTopGuard(...a: Lift<unknown>[]): typeof Top | typeof Bottom | undefined {
	if(a.some(isBottom)) {
		return Bottom;
	} else if(a.some(isTop)) {
		return Top;
	}
}

export function valueSetGuard(a: Lift<ValueSet<Value[]>>): ValueSet<Value[]> | undefined {
	return (isBottom(a) || isTop(a)) ? undefined : a;
}

export function valueFromTsValue(a: unknown): Value {
	if(a === undefined) {
		return Bottom;
	} else if(a === null) {
		return Top;
	} else if(typeof a === 'string') {
		return stringFrom(a);
	} else if(typeof a === 'number') {
		return intervalFrom(a, a);
	} else if(typeof a === 'boolean') {
		return a ? ValueLogicalTrue : ValueLogicalFalse;
	}

	return Top;
}