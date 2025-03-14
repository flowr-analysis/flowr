import type { Lift, ValueLogical } from '../r-value';
import { bottomTopGuard } from '../general';

/**
 * Take one potentially lifted logical and apply the given unary op.
 * This propagates `top` and `bottom` values.
 */
export function unaryLogical<A extends Lift<ValueLogical>>(
	a: A,
	op: keyof typeof Operations
): Lift<ValueLogical> {
	return bottomTopGuard(a) ?? Operations[op](a as ValueLogical);
}

const Operations = {
	not: logicalNot
} as const;

function logicalNot<A extends ValueLogical>(a: A): ValueLogical {
	const val = bottomTopGuard(a.value);
	return {
		type:  'logical',
		value: val ?? (a.value === 'maybe' ? 'maybe' : !a.value)
	};
}
