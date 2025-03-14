import type { Lift, ValueNumber } from '../r-value';
import { bottomTopGuardSingle } from '../general';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';

/**
 * Take a potentially lifted interval and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function unaryScalar<A extends Lift<ValueNumber>>(
	a: A,
	op: keyof typeof Operations
): Lift<ValueNumber> {
	return bottomTopGuardSingle(a) ?? Operations[op](a as ValueNumber);
}

const Operations = {
	negate: scalarNegate
} as const satisfies Record<string, (a: ValueNumber) => ValueNumber>;

function scalarNegate<A extends ValueNumber>(a: A): ValueNumber {
	const val = bottomTopGuardSingle(a.value);
	const aval = a.value as RNumberValue;
	return {
		type:  'number',
		value: val ?? {
			markedAsInt:   aval.markedAsInt,
			complexNumber: aval.complexNumber,
			num:           -aval.num
		}
	};
}