import type { ValueNumber } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';

/**
 * Take a potentially lifted interval and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function unaryScalar<A extends ValueNumber>(
	a: A,
	op: keyof typeof ScalarUnaryOperations
): ValueNumber {
	return ScalarUnaryOperations[op](a as ValueNumber);
}

const ScalarUnaryOperations = {
	id:     a => a,
	negate: a => scalarHelper(a, (a) => -a),
	abs:    a => scalarHelper(a, Math.abs),
	ceil:   a => scalarHelper(a, Math.ceil),
	floor:  a => scalarHelper(a, Math.floor),
	round:  a => scalarHelper(a, Math.round),
	exp:    a => scalarHelper(a, Math.exp),
	log:    a => scalarHelper(a, Math.log),
	log10:  a => scalarHelper(a, Math.log10),
	log2:   a => scalarHelper(a, Math.log2),
	sign:   a => scalarHelper(a, Math.sign),
	sqrt:   a => scalarHelper(a, Math.sqrt),
	sin:    a => scalarHelper(a, Math.sin),
	cos:    a => scalarHelper(a, Math.cos),
	tan:    a => scalarHelper(a, Math.tan),
	asin:   a => scalarHelper(a, Math.asin),
	acos:   a => scalarHelper(a, Math.acos),
	atan:   a => scalarHelper(a, Math.atan),
	sinh:   a => scalarHelper(a, Math.sinh),
	cosh:   a => scalarHelper(a, Math.cosh),
	tanh:   a => scalarHelper(a, Math.tanh)
} as const satisfies Record<string, (a: ValueNumber) => ValueNumber>;

export type ScalarUnaryOperation = keyof typeof ScalarUnaryOperations;

// TODO: support sin clamp to [-1, 1] etc.
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