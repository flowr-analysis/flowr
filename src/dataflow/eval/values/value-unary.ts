import type { Lift, Value, ValueTypes } from './r-value';
import { Bottom, isBottom, isTop, Top } from './r-value';
import { binaryScalar } from './scalar/scalar-binary';
import { unaryScalar } from './scalar/scalar-unary';
import { unaryLogical } from './logical/logical-unary';
import { unaryInterval } from './intervals/interval-unary';

const unaryForType = {
	'number':   unaryScalar,
	'logical':  unaryLogical,
	'interval': unaryInterval,
	'string':   binaryScalar, // TODO
	'set':      binaryScalar, // TODO
	'vector':   binaryScalar // TODO
} as const satisfies Record<ValueTypes, unknown>;


export function unaryValues<A extends Lift<Value>>(
	a: A,
	op: string
): Value {
	if(isBottom(a)) {
		return Bottom;
	} else if(isTop(a)) {
		return Top;
	}
	return unaryEnsured(a, op, a, a.type);
}

function unaryEnsured<A extends Value, B extends Value>(
	a: A, op: string, b: B,
	type: ValueTypes
): Value {
	// TODO: top if not existing
	return (unaryForType[type as keyof typeof unaryForType] as (a: Value, op: string) => Value)(a, op);
}