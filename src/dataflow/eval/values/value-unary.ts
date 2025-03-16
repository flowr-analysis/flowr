import type { Lift, Value } from './r-value';
import { stringifyValue , Bottom, isBottom, isTop, Top } from './r-value';
import { unaryScalar } from './scalar/scalar-unary';
import { unaryLogical } from './logical/logical-unary';
import { unaryInterval } from './intervals/interval-unary';
import { unaryVector } from './vectors/vector-unary';
import { guard } from '../../../util/assert';
import { expensiveTrace } from '../../../util/log';
import { ValueEvalLog } from '../eval';
import { unarySet } from './sets/set-unary';
import { unaryString } from './string/string-unary';

let unaryForType: Record<string, (a: unknown, op: string) => Value> = undefined as unknown as Record<string, (a: unknown, op: string) => Value>;

function initialize() {
	unaryForType ??= {
		'number':   unaryScalar,
		'logical':  unaryLogical,
		'interval': unaryInterval,
		'string':   unaryString,
		'vector':   unaryVector,
		'set':      unarySet
	} as Record<string, (a: unknown, op: string) => Value>;
}


export function unaryValue<A extends Lift<Value>>(
	a: A,
	op: string
): Value {
	expensiveTrace(ValueEvalLog, () => ` * unaryValue(${stringifyValue(a)}, ${op})`);

	if(isBottom(a)) {
		return Bottom;
	} else if(isTop(a)) { // if we do not even know the vector shape, there is not really anything to do
		return Top;
	}
	return unaryEnsured(a, op, a.type);
}

function unaryEnsured(
	a: Value, op: string,
	type: string
): Value {
	initialize();
	guard(unaryForType[type], `No unary operation for type ${type}`);
	return (unaryForType[type] as (a: Value, op: string) => Value)(a, op);
}