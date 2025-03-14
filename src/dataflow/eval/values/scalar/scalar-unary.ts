import type { Lift, ValueNumber } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';

/**
 * Take a potentially lifted interval and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function unaryScalar<A extends Lift<ValueNumber>>(
	a: A,
	op: keyof typeof Operations
): Lift<ValueNumber> {
	return bottomTopGuard(a) ?? Operations[op](a as ValueNumber);
}

const Operations = {
	negate: (a: ValueNumber) => scalarHelper(a, (a) => -a),
	abs:    (a: ValueNumber) => scalarHelper(a, Math.abs),
	ceil:   (a: ValueNumber) => scalarHelper(a, Math.ceil),
	floor:  (a: ValueNumber) => scalarHelper(a, Math.floor),
	round:  (a: ValueNumber) => scalarHelper(a, Math.round),
	exp:    (a: ValueNumber) => scalarHelper(a, Math.exp),
	log:    (a: ValueNumber) => scalarHelper(a, Math.log),
	log10:  (a: ValueNumber) => scalarHelper(a, Math.log10),
	log2:   (a: ValueNumber) => scalarHelper(a, Math.log2),
	sign:   (a: ValueNumber) => scalarHelper(a, Math.sign),
	sqrt:   (a: ValueNumber) => scalarHelper(a, Math.sqrt),
	sin:    (a: ValueNumber) => scalarHelper(a, Math.sin),
	cos:    (a: ValueNumber) => scalarHelper(a, Math.cos),
	tan:    (a: ValueNumber) => scalarHelper(a, Math.tan),
	asin:   (a: ValueNumber) => scalarHelper(a, Math.asin),
	acos:   (a: ValueNumber) => scalarHelper(a, Math.acos),
	atan:   (a: ValueNumber) => scalarHelper(a, Math.atan),
	sinh:   (a: ValueNumber) => scalarHelper(a, Math.sinh),
	cosh:   (a: ValueNumber) => scalarHelper(a, Math.cosh),
	tanh:   (a: ValueNumber) => scalarHelper(a, Math.tanh),

} as const satisfies Record<string, (a: ValueNumber) => ValueNumber>;

function scalarHelper<A extends ValueNumber>(a: A, op: (a: number) => number): ValueNumber {
	const val = bottomTopGuard(a.value);
	const aval = a.value as RNumberValue;
	return {
		type:  'number',
		value: val ?? {
			markedAsInt:   aval.markedAsInt,
			complexNumber: aval.complexNumber,
			num:           op(aval.num)
		}
	};
}