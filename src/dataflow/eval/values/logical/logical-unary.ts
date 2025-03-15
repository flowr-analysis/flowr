import type { Lift, ValueInterval, ValueLogical } from '../r-value';
import { bottomTopGuard } from '../general';
import { iteLogical } from './logical-check';
import {
	ValueIntervalBottom,
	ValueIntervalOne,
	ValueIntervalTop,
	ValueIntervalZero,
	ValueIntervalZeroToOne
} from '../intervals/interval-constants';

/**
 * Take one potentially lifted logical and apply the given unary op.
 * This propagates `top` and `bottom` values.
 */
export function unaryLogical<A extends Lift<ValueLogical>>(
	a: A,
	// TODO: support common unary ops
	op: keyof typeof Operations
): Lift<ValueLogical> {
	return bottomTopGuard(a) ?? Operations[op](a as ValueLogical);
}

/*
	toNumber: (a: ValueLogical) => iteLogical(a, {
		onTrue:  ValueIntervalZero,
		onMaybe: ValueNumberOneHalf,
		onFalse: ValueIntegerOne,
	}),
	toInterval: (a: ValueLogical) => iteLogical(a, {
		onTrue:  intervalFromValues(0),
		onMaybe: getScalarFromInteger(0.5, false),
		onFalse: getScalarFromInteger(1),
	})

 */

export function logicalToInterval<A extends ValueLogical>(a: A): ValueInterval {
	return iteLogical(a, {
		onTrue:   ValueIntervalZero,
		onMaybe:  ValueIntervalZeroToOne,
		onFalse:  ValueIntervalOne,
		onTop:    ValueIntervalTop,
		onBottom: ValueIntervalBottom
	});
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
