import type { ValueNumber } from '../r-value';
import { Bottom } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';
import { liftScalar, ValueIntegerBottom, ValueIntegerTop } from './scalar-constants';

/**
 * Take two potentially lifted intervals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryScalar<A extends ValueNumber, B extends ValueNumber>(
	a: A,
	op: keyof typeof ScalarBinaryOperations,
	b: B
): ValueNumber {
	return ScalarBinaryOperations[op](a as ValueNumber, b as ValueNumber);
}


const ScalarBinaryOperations = {
	add: (a, b) => scalarHelper(a, b, (a, b) => a + b),
	sub: (a, b) => scalarHelper(a, b, (a, b) => a - b),
	mul: (a, b) => scalarHelper(a, b, (a, b) => a * b),
	div: (a, b) => scalarHelper(a, b, (a, b) => a / b),
	pow: (a, b) => scalarHelper(a, b, (a, b) => a ** b),
	mod: (a, b) => scalarHelper(a, b, (a, b) => a % b),
	max: (a, b) => scalarMaxMin(a, b, 'max'),
	min: (a, b) => scalarMaxMin(a, b, 'min'),
} as const satisfies Record<string, (a: ValueNumber, b: ValueNumber) => ValueNumber>;

export type ScalarBinaryOperation = keyof typeof ScalarBinaryOperations;

function scalarHelper<A extends ValueNumber, B extends ValueNumber>(
	a: A,
	b: B,
	c: (a: number, b: number) => number
): ValueNumber {
	const val = bottomTopGuard(a.value, b.value);
	if(val) {
		return val === Bottom ? ValueIntegerBottom : ValueIntegerTop;
	}
	const aval = a.value as RNumberValue;
	const bval = b.value as RNumberValue;
	/* do not calculate if top or bot */
	const result = c(aval.num, bval.num);
	return liftScalar({
		markedAsInt:   aval.markedAsInt && bval.markedAsInt && Number.isInteger(result),
		complexNumber: aval.complexNumber || bval.complexNumber,
		num:           result
	});
}

// max and min do not have to create knew objects
function scalarMaxMin<A extends ValueNumber, B extends ValueNumber>(a: A, b: B, c: 'max' | 'min'): ValueNumber {
	const bt = bottomTopGuard(a.value, b.value);
	if(bt) {
		return ValueIntegerTop;
	}
	const aval = a.value as RNumberValue;
	const bval = b.value as RNumberValue;
	const takeA = c === 'max' ? aval.num > bval.num : aval.num < bval.num;
	return takeA ? a : b;
}
