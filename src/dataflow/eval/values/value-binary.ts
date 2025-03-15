import type { Lift, Value } from './r-value';
import { Bottom , isBottom, isTop, Top } from './r-value';
import { intervalFromValues } from './intervals/interval-constants';
import { binaryScalar } from './scalar/scalar-binary';
import { binaryLogical } from './logical/logical-binary';
import { binaryInterval } from './intervals/interval-binary';
import { vectorFrom } from './vectors/vector-constants';
import { binaryVector } from './vectors/vector-binary';
import { binaryString } from './string/string-binary';
import { guard } from '../../../util/assert';
import { ValueLogicalFalse, ValueLogicalTrue } from './logical/logical-constants';

let binaryForType: Record<string, (a: unknown, op: string, b: unknown) => Value> = undefined as unknown as Record<string, (a: unknown, op: string, b: unknown) => Value>;

function initialize() {
	binaryForType ??= {
		'number':   binaryScalar,
		'logical':  binaryLogical,
		'interval': binaryInterval,
		'string':   binaryString,
		'vector':   binaryVector
	} as Record<string, (a: unknown, op: string, b: unknown) => Value>;
}

export function binaryValue(
	a: Lift<Value>,
	op: string,
	b: Lift<Value>
): Value {
	if(isBottom(a) || isBottom(b)) {
		if(op === '===') {
			return a === b ? ValueLogicalTrue : ValueLogicalFalse;
		} else if(op === '!==') {
			return a !== b ? ValueLogicalTrue : ValueLogicalFalse;
		} else {
			return Bottom;
		}
	} else if(isTop(a)) {
		if(isTop(b)) {
			if(op === '===') {
				return ValueLogicalTrue;
			} else if(op === '!==') {
				return ValueLogicalFalse;
			} else {
				return Top;
			}
		} else {
			return binaryEnsured(a, op, b, b.type);
		}
	} else if(isTop(b)) {
		return binaryEnsured(a, op, b, a.type);
	}

	if(a.type === b.type) {
		return binaryEnsured(a, op, b, a.type);
	} else if(a.type === 'vector') {
		return binaryValue(a, op, vectorFrom(b));
	} else if(b.type === 'vector') {
		return binaryValue(vectorFrom(a), op, b);
	}
	if(a.type === 'interval' && b.type === 'number') {
		return binaryEnsured(a, op, intervalFromValues(b, b), a.type);
	} else if(a.type === 'number' && b.type === 'interval') {
		return binaryEnsured(intervalFromValues(a, a), op, b, b.type);
	}
	return Top;
}

function binaryEnsured<A extends Value, B extends Value>(
	a: A, op: string, b: B,
	type: string
): Value {
	initialize();
	guard(type in binaryForType, `Unknown binary operation for type: ${type}`);
	return (binaryForType[type] as (a: Value, op: string, b: Value) => Value)(a, op, b);
}