import type { Lift, TernaryLogical, ValueLogical } from '../r-value';
import { bottomTopGuard } from '../general';

/**
 * Take two potentially lifted logicals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryLogical<A extends Lift<ValueLogical>, B extends Lift<ValueLogical>>(
	a: A,
	b: B,
	op: keyof typeof Operations
): Lift<ValueLogical> {
	return bottomTopGuard(a, b) ?? Operations[op](a as ValueLogical, b as ValueLogical);
}

const Operations = {
	and:     (a, b) => logicalHelper(a, b, (a, b) => a && b),
	or:      (a, b) => logicalHelper(a, b, (a, b) => a || b),
	xor:     (a, b) => logicalHelper(a, b, (a, b) => a !== b),
	implies: (a, b) => logicalHelper(a, b, (a, b) => !a || b),
	iff:     (a, b) => logicalHelper(a, b, (a, b) => a === b),
	nand:    (a, b) => logicalHelper(a, b, (a, b) => !(a && b)),
	nor:     (a, b) => logicalHelper(a, b, (a, b) => !(a || b)),
} as const satisfies Record<string, (a: ValueLogical, b: ValueLogical) => ValueLogical>;

function logicalHelper<A extends ValueLogical, B extends ValueLogical>(a: A, b: B, op: (a: TernaryLogical, b: TernaryLogical) => TernaryLogical): ValueLogical {
	const botTopGuard = bottomTopGuard(a.value, b.value);
	return {
		type:  'logical',
		value: botTopGuard ?? op(a.value as TernaryLogical, b.value as TernaryLogical)
	};
}
