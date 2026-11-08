import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RValue } from './r-value';
import { intervalFrom, intervalFromValues } from './intervals/interval-constants';
import { ValueLogicalFalse, ValueLogicalTrue } from './logical/logical-constants';
import { type Lift, type Value, type ValueInterval, type ValueSet, Bottom, isBottom, isTop, Top } from './r-value';
import { stringFrom } from './string/string-constants';
import { vectorFrom } from './vectors/vector-constants';
import { Resolve } from '../../environments/resolve-helper';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RLogical } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { RNumber } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RNumberValue } from '../../../r-bridge/lang-4.x/convert-values';
import { getScalarFromInteger } from './scalar/scalar-constants';

/**
 * Takes n potentially lifted ops and returns `Top` or `Bottom` if any is `Top` or `Bottom`.
 */
export function bottomTopGuard(...a: Lift<unknown>[]): typeof Top | typeof Bottom | undefined {
	return bottomTopGuardOf(a);
}

/** {@link bottomTopGuard} for a list that is already one, which a spread of many elements could not pass on */
export function bottomTopGuardOf(a: readonly Lift<unknown>[]): typeof Top | typeof Bottom | undefined {
	if(a.some(isBottom)) {
		return Bottom;
	} else if(a.some(isTop)) {
		return Top;
	}
}

/**
 * Returns a value set, if a is not bottom or top, otherwise undefined.
 * Useful when working with values returned by {@link Resolve.toValue}
 * @param a - value set to check
 * @returns value set if a is not top or bottom
 */
export function valueSetGuard(a: Lift<ValueSet<Value[]>>): ValueSet<Value[]> | undefined {
	return (isBottom(a) || isTop(a)) ? undefined : a;
}

/**
 * @useInstead {@link NodeValue.sole}
 */
export function soleValue(this: void, set: ValueSet<Value[]> | undefined): Value | undefined;
export function soleValue<T extends Value['type']>(this: void, set: ValueSet<Value[]> | undefined, type: T): Extract<Value, { type: T }> | undefined;
/**
 * The one value a set holds, `undefined` unless it holds exactly one, optionally of the given kind.
 * @param set  - the set to take the value from
 * @param type - the kind the value has to have, any kind if unset
 * @returns    the sole value, `undefined` if the set holds another number of them or another kind
 */
export function soleValue<T extends Value['type']>(this: void, set: ValueSet<Value[]> | undefined, type?: T): Value | undefined {
	const only = set?.elements.length === 1 ? set.elements[0] : undefined;
	return only !== undefined && (type === undefined || only.type === type) ? only : undefined;
}

/**
 * Constructs an Abstract Value from a normal TS value
 * @param a - ts value
 * @returns abstract value
 */
export function valueFromTsValue(a: unknown): Value {
	if(a === Top || a === Bottom) {
		/* what a definition states outright, as `NA` does: R has a value there, flowR has no way to hold it */
		return a as Value;
	} else if(a === undefined) {
		return Bottom;
	} else if(a === null) {
		return { type: 'null' };
	} else if(typeof a === 'string') {
		return stringFrom(a);
	} else if(typeof a === 'number') {
		return intervalFrom(a, a);
	} else if(typeof a === 'boolean') {
		return a ? ValueLogicalTrue : ValueLogicalFalse;
	} else if(Array.isArray(a)) {
		return vectorFrom(a.map(v => valueFromTsValue(v)));
	}

	return Top;
}

/**
 * The interval a number literal stands for. A complex literal keeps its flag, so that nothing folds `2i` as
 * the real number its lexeme starts with.
 */
export function valueFromRNumber(value: RNumberValue): ValueInterval {
	const scalar = getScalarFromInteger(value.num, !value.complexNumber && Number.isInteger(value.num), value.complexNumber);
	return intervalFromValues(scalar, scalar);
}

/**
 * Converts a constant from an RNode into an abstract value
 * @param a - RNode constant
 * @returns abstract value
 */
export function valueFromRNodeConstant(a: RNodeWithParent): Value {
	if(RString.is(a)) {
		return RValue.ofStringLiteral(a.content) ?? Top;
	} else if(RNumber.is(a)) {
		return valueFromRNumber(a.content);
	} else if(RLogical.is(a)) {
		return a.content.valueOf() ? ValueLogicalTrue : ValueLogicalFalse;
	} else if(RFunctionDefinition.is(a)) {
		return { type: 'function-definition' };
	}

	return Top;
}