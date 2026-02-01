import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { intervalFrom } from './intervals/interval-constants';
import { ValueLogicalFalse, ValueLogicalTrue } from './logical/logical-constants';
import { type Lift, type Value, type ValueSet, Bottom, isBottom, isTop, Top } from './r-value';
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

/**
 * Returns a value set, if a is not bottom or top, otherwise undefined.
 * Useful when working with values returned by {@link resolveIdToValue}
 * @param a - value set to check
 * @returns value set if a is not top or bottom
 */
export function valueSetGuard(a: Lift<ValueSet<Value[]>>): ValueSet<Value[]> | undefined {
	return (isBottom(a) || isTop(a)) ? undefined : a;
}

/**
 * Constructs an Abstract Value from a normal TS value
 * @param a - ts value
 * @returns abstract value
 */
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


/**
 * Converts a constant from an RNode into an abstract value
 * @param a - RNode constant
 * @returns abstract value
 */
export function valueFromRNodeConstant(a: RNodeWithParent): Value {
	if(a.type === RType.String) {
		return stringFrom(a.content.str);
	} else if(a.type === RType.Number) {
		return intervalFrom(a.content.num, a.content.num);
	} else if(a.type === RType.Logical) {
		return a.content.valueOf() ? ValueLogicalTrue : ValueLogicalFalse;
	}

	return Top;
}