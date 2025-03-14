import type { Lift, ValueInterval } from '../r-value';
import { bottomTopGuardSingle } from '../general';
import { ValueIntegerNegativeOne } from '../scalar/scalar-constants';
import { binaryScalar } from '../scalar/scalar-binary';

/**
 * Take two potentially lifted intervals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function unaryInterval<A extends Lift<ValueInterval>>(
	a: A,
	op: keyof typeof Operations
): Lift<ValueInterval> {
	return bottomTopGuardSingle(a) ?? Operations[op](a as ValueInterval);
}

const Operations = {
	negate: intervalNegate
} as const;

function intervalNegate<A extends ValueInterval>(a: A): ValueInterval {
	return {
		type:           'interval',
		startInclusive: a.endInclusive,
		start:          binaryScalar(a.end, ValueIntegerNegativeOne, 'mul'),
		endInclusive:   a.startInclusive,
		end:            binaryScalar(a.start, ValueIntegerNegativeOne, 'mul')
	};
}
