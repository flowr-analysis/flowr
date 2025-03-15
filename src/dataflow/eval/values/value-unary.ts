import type { Lift, Value } from './r-value';
import { Bottom, isBottom, isTop, Top } from './r-value';
import { unaryScalar } from './scalar/scalar-unary';
import { unaryLogical } from './logical/logical-unary';
import { unaryInterval } from './intervals/interval-unary';
import { unaryVector } from './vectors/vector-unary';
import { guard } from '../../../util/assert';

let unaryForType: Record<string, (a: unknown, op: string) => Value> = undefined as unknown as Record<string, (a: unknown, op: string) => Value>;

function initialize() {
	unaryForType ??= {
		'number':   unaryScalar,
		'logical':  unaryLogical,
		'interval': unaryInterval,
		'string':   unaryScalar, // TODO
		'vector':   unaryVector
	} as Record<string, (a: unknown, op: string) => Value>;
}


export function unaryValue<A extends Lift<Value>>(
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
	type: string
): Value {
	initialize();
	guard(unaryForType[type], `No unary operation for type ${type}`);
	return (unaryForType[type] as (a: Value, op: string) => Value)(a, op);
}