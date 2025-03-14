import type { Lift, ValueNumber } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';

/**
 * Take two potentially lifted intervals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryScalar<A extends Lift<ValueNumber>, B extends Lift<ValueNumber>>(
	a: A,
	b: B,
	op: keyof typeof Operations
): Lift<ValueNumber> {
	return bottomTopGuard(a, b) ?? Operations[op](a as ValueNumber, b as ValueNumber);
}

const Operations = {
	add: (a, b) => scalarHelper(a, b, (a, b) => a + b),
	sub: (a, b) => scalarHelper(a, b, (a, b) => a - b),
	mul: (a, b) => scalarHelper(a, b, (a, b) => a * b),
	div: (a, b) => scalarHelper(a, b, (a, b) => a / b),
	pow: (a, b) => scalarHelper(a, b, (a, b) => a ** b),
	mod: (a, b) => scalarHelper(a, b, (a, b) => a % b),
	max: (a, b) => scalarHelper(a, b, (a, b) => Math.max(a, b)),
	min: (a, b) => scalarHelper(a, b, (a, b) => Math.min(a, b)),
} as const satisfies Record<string, (a: ValueNumber, b: ValueNumber) => ValueNumber>;

function scalarHelper<A extends ValueNumber, B extends ValueNumber>(
	a: A,
	b: B,
	c: (a: number, b: number) => number
): ValueNumber {
	const val = bottomTopGuard(a.value, b.value);
	const aval = a.value as RNumberValue;
	const bval = b.value as RNumberValue;
	const result = c(aval.num, bval.num);
	return {
		type:  'number',
		value: val ?? {
			markedAsInt:   aval.markedAsInt && bval.markedAsInt && Number.isInteger(result),
			complexNumber: aval.complexNumber || bval.complexNumber,
			num:           result
		}
	};
}