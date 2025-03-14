import type { Lift, ValueLogical } from '../r-value';
import { bottomTopGuardSingle } from '../general';

/**
 * Take one potentially lifted logical and apply the given unary op.
 * This propagates `top` and `bottom` values.
 */
export function unaryLogical<A extends Lift<ValueLogical>>(
	a: A,
	op: keyof typeof Operations
): Lift<ValueLogical> {
	return bottomTopGuardSingle(a) ?? Operations[op](a as ValueLogical);
}

const Operations = {
	not: logicalNot
} as const;

function logicalNot<A extends ValueLogical>(a: A): ValueLogical {
	const val = bottomTopGuardSingle(a.value);
	return {
		type:  'logical',
		value: val ?? !a.value
	};
}
