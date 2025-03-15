import type { Lift, Value, ValueTypes } from './r-value';
import { Bottom, isBottom, isTop, Top } from './r-value';
import { ValueLogicalTop } from './logical/logical-constants';
import { intervalFromValues } from './intervals/interval-constants';
import { binaryScalar } from './scalar/scalar-binary';
import { binaryLogical } from './logical/logical-binary';
import { binaryInterval } from './intervals/interval-binary';

const binaryForType = {
	'number':   binaryScalar,
	'logical':  binaryLogical,
	'interval': binaryInterval,
	'string':   binaryScalar, // TODO
	'set':      binaryScalar, // TODO
	'vector':   binaryScalar // TODO
} as const satisfies Record<ValueTypes, unknown>;


export function binaryValues<A extends Lift<Value>, B extends Lift<Value>>(
	a: A,
	op: string,
	b: B
): Value {
	if(isBottom(a) || isBottom(b)) {
		return Bottom;
	}

	if(isTop(a)) {
		if(isTop(b)) {
			return Top;
		} else {
			return binaryEnsured(a, op, b, b.type);
		}
	} else if(isTop(b)) {
		return binaryEnsured(a, op, b, a.type);
	}

	if(a.type === b.type) {
		return binaryEnsured(a, op, b, a.type);
	}

	if(a.type === 'interval' && b.type === 'number') {
		return binaryEnsured(a, op, intervalFromValues(b, b), a.type);
	} else if(a.type === 'number' && b.type === 'interval') {
		return binaryEnsured(intervalFromValues(a, a), op, b, b.type);
	}

	return ValueLogicalTop;
}

function binaryEnsured<A extends Value, B extends Value>(
	a: A, op: string, b: B,
	type: ValueTypes
): Value {
	// TODO: top if not existing
	return (binaryForType[type as keyof typeof binaryForType] as (a: Value, op: string, b: Value) => Value)(a, op, b);
}