import type { Lift, Value, ValueLogical, ValueTypes } from './r-value';
import { isBottom, isTop } from './r-value';
import { liftLogical, ValueLogicalBot, ValueLogicalTop } from './logical/logical-constants';
import { compareScalar } from './scalar/scalar-compare';
import { compareLogical } from './logical/logical-compare';
import { compareInterval } from './intervals/interval-compare';
import { guard } from '../../../util/assert';
import { intervalFromValues } from './intervals/interval-constants';
import { compareString } from './string/string-compare';

export type ValueCompareOperation = '<' | '>' | '<=' | '>=' | '===' | '!=='
    | '==' | '!=' | '⊆' | '⊂' | '⊃' | '⊇';

// besides identical and top/bot
const comparableTypes = new Set([
	['number', 'interval']
].flatMap(([a, b]) => [`${a}<>${b}`, `${b}<>${a}`]));


export const GeneralCompareOperations = {
	'meta:identical-objects': (a, b) => liftLogical(a === b),
	'meta:comparable':        (a, b) => liftLogical(
		isTop(a) || isTop(b) || isBottom(a) || isBottom(b) || a.type === b.type || comparableTypes.has(`${a.type}<>${b.type}`)
	)
} as const satisfies Record<string, (a: Value, b: Value) => ValueLogical>;


const compareForType = {
	'number':   compareScalar,
	'logical':  compareLogical,
	'interval': compareInterval,
	'string':   compareString,
	'set':      compareScalar, // TODO
	'vector':   compareScalar // TODO
} as const satisfies Record<ValueTypes, unknown>;

export function compareValues<A extends Lift<Value>, B extends Lift<Value>>(
	a: A,
	op: ValueCompareOperation | keyof typeof GeneralCompareOperations,
	b: B
): Lift<ValueLogical> {
	const general: undefined | ((a: Value, b: Value) => ValueLogical) = GeneralCompareOperations[op as keyof typeof GeneralCompareOperations];
	if(general !== undefined) {
		return general(a, b);
	}
	if(isBottom(a) || isBottom(b)) {
		return ValueLogicalBot;
	}

	if(isTop(a)) {
		if(isTop(b)) {
			return ValueLogicalTop;
		} else {
			return compareEnsured(a, op, b, b.type);
		}
	} else if(isTop(b)) {
		return compareEnsured(a, op, b, a.type);
	}

	if(a.type === b.type) {
		return compareEnsured(a, op, b, a.type);
	}

	guard(comparableTypes.has(`${a.type}<>${b.type}`), `Cannot compare ${a.type} with ${b.type}`);

	if(a.type === 'interval' && b.type === 'number') {
		return compareEnsured(a, op, intervalFromValues(b, b), a.type);
	} else if(a.type === 'number' && b.type === 'interval') {
		return compareEnsured(intervalFromValues(a, a), op, b, b.type);
	}

	return ValueLogicalTop;
}

function compareEnsured<A extends Lift<Value>, B extends Lift<Value>>(
	a: A, op: string, b: B,
	type: ValueTypes
): Lift<ValueLogical> {
	return (compareForType[type as keyof typeof compareForType] as (a: Value, op: string, b: Value) => Lift<ValueLogical>)(a, op, b);
}