import type { Lift, Value, ValueInterval, ValueLogical } from '../r-value';
import { Top , stringifyValue } from '../r-value';
import { bottomTopGuard } from '../general';
import { iteLogical } from './logical-check';
import {
	ValueIntervalBottom,
	ValueIntervalOne,
	ValueIntervalTop,
	ValueIntervalZero,
	ValueIntervalZeroToOne
} from '../intervals/interval-constants';
import { expensiveTrace } from '../../../../util/log';
import { ValueEvalLog } from '../../eval';
import { unaryInterval } from '../intervals/interval-unary';

/**
 * Take one potentially lifted logical and apply the given unary op.
 * This propagates `top` and `bottom` values.
 */
export function unaryLogical(
	a: Lift<ValueLogical>,
	// TODO: support common unary ops
	op: string
): Value {
	let res: Value | undefined = bottomTopGuard(a);
	if(op in Operations) {
		res = Operations[op as keyof typeof Operations](a as ValueLogical);
	} else {
		res = unaryInterval(logicalToInterval(a as ValueLogical), op);
	}
	expensiveTrace(ValueEvalLog, () => ` * unaryLogical(${stringifyValue(a)}, ${op}) = ${stringifyValue(res)}`);
	return res ?? Top;
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
