import type { Lift, ValueLogical, ValueNumber } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';

/**
 * Take two potentially lifted intervals and compare them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function compareScalar<A extends Lift<ValueNumber>, B extends Lift<ValueNumber>>(
	a: A,
	b: B,
	op: keyof typeof Operations
): Lift<ValueLogical> {
	return bottomTopGuard(a, b) ?? Operations[op](a as ValueNumber, b as ValueNumber);
}

const Operations = {
	'<=': (a, b) => scalarHelper(a, b, (a, b) => a <= b),
	'<':  (a, b) => scalarHelper(a, b, (a, b) => a < b),
	'>=': (a, b) => scalarHelper(a, b, (a, b) => a >= b),
	'>':  (a, b) => scalarHelper(a, b, (a, b) => a > b),
	'==': (a, b) => scalarHelper(a, b, (a, b) => a === b),
	'!=': (a, b) => scalarHelper(a, b, (a, b) => a !== b)
} as const satisfies Record<string, (a: ValueNumber, b: ValueNumber) => ValueLogical>;

function scalarHelper<A extends ValueNumber, B extends ValueNumber>(
	a: A,
	b: B,
	c: (a: number, b: number) => boolean
): ValueLogical {
	const val = bottomTopGuard(a.value, b.value);
	const aval = a.value as RNumberValue;
	const bval = b.value as RNumberValue;
	return {
		type:  'logical',
		value: val ?? c(aval.num, bval.num)
	};
}