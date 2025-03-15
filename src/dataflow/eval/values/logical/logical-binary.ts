import type { Lift, TernaryLogical, ValueLogical } from '../r-value';
import { bottomTopGuard } from '../general';
import { guard } from '../../../../util/assert';

/**
 * Take two potentially lifted logicals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryLogical(
	a: Lift<ValueLogical>,
	op: string,
	b: Lift<ValueLogical>
): Lift<ValueLogical> {
	guard(op in Operations, `Unknown logical binary operation: ${op}`);
	return Operations[op as keyof typeof Operations](a, b);
}

const Operations = {
	and: (a, b) => logicalHelper(a, b, (a, b) => {
		if(a === false || b === false) {
			return false;
		} else if(a === true && b === true) {
			return true;
		} else {
			return 'maybe';
		}
	}),
	or: (a, b) => logicalHelper(a, b, (a, b) => {
		if(a === true || b === true) {
			return true;
		} else if(a === false && b === false) {
			return false;
		} else {
			return 'maybe';
		}
	}),
	xor: (a, b) => logicalHelper(a, b, (a, b) => {
		if(a === 'maybe' || b === 'maybe') {
			return 'maybe';
		} else {
			return a !== b;
		}
	}),
	implies: (a, b) => logicalHelper(a, b, (a, b) => {
		if(a === true) {
			return b;
		} else if(a === false) {
			return true;
		} else {
			return 'maybe';
		}
	}),
	iff: (a, b) => logicalHelper(a, b, (a, b) => {
		if(a === 'maybe' || b === 'maybe') {
			return 'maybe';
		} else {
			return a === b;
		}
	})
} as const satisfies Record<string, (a: Lift<ValueLogical>, b: Lift<ValueLogical>) => Lift<ValueLogical>>;

function logicalHelper<A extends Lift<ValueLogical>, B extends Lift<ValueLogical>>(a: A, b: B, op: (a: TernaryLogical, b: TernaryLogical) => TernaryLogical): Lift<ValueLogical> {
	const botTopGuard = bottomTopGuard(a, b) ?? bottomTopGuard((a as ValueLogical).value, (b as ValueLogical).value);
	return {
		type:  'logical',
		value: botTopGuard ?? op((a as ValueLogical).value as TernaryLogical, (b as ValueLogical).value as TernaryLogical)
	};
}
