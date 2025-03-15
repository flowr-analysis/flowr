import type { Lift, Value, ValueLogical, ValueNumber } from '../r-value';
import { asValue, Bottom , isBottom , isTop, Top } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';
import { liftScalar } from './scalar-constants';
import { guard } from '../../../../util/assert';
import { liftLogical, ValueLogicalBot, ValueLogicalTop } from '../logical/logical-constants';
import { ValueIntervalMinusOneToOne, ValueIntervalZeroToPositiveInfinity } from '../intervals/interval-constants';

/**
 * Take a potentially lifted interval and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function unaryScalar(
	a: Lift<ValueNumber>,
	op: string
): Value {
	guard(op in ScalarUnaryOperations, `Unknown scalar unary operation: ${op}`);
	return ScalarUnaryOperations[op as keyof typeof ScalarUnaryOperations](a);
}

const ScalarUnaryOperations = {
	id:                  a => a,
	negate:              a => scalarHelper(a, (a) => -a),
	abs:                 a => scalarHelper(a, Math.abs, ValueIntervalZeroToPositiveInfinity),
	ceil:                a => scalarHelper(a, Math.ceil),
	floor:               a => scalarHelper(a, Math.floor),
	round:               a => scalarHelper(a, Math.round),
	exp:                 a => scalarHelper(a, Math.exp),
	log:                 a => scalarHelper(a, Math.log),
	log10:               a => scalarHelper(a, Math.log10),
	log2:                a => scalarHelper(a, Math.log2),
	sign:                a => scalarHelper(a, Math.sign),
	sqrt:                a => scalarHelper(a, Math.sqrt),
	sin:                 a => scalarHelper(a, Math.sin, ValueIntervalMinusOneToOne),
	cos:                 a => scalarHelper(a, Math.cos, ValueIntervalMinusOneToOne),
	tan:                 a => scalarHelper(a, Math.tan, ValueIntervalMinusOneToOne),
	asin:                a => scalarHelper(a, Math.asin),
	acos:                a => scalarHelper(a, Math.acos),
	atan:                a => scalarHelper(a, Math.atan),
	sinh:                a => scalarHelper(a, Math.sinh),
	cosh:                a => scalarHelper(a, Math.cosh),
	tanh:                a => scalarHelper(a, Math.tanh),
	/** `=== 0` */
	'isZero':            s => scalarCheck(s, n => n === 0),
	/** `> 0` */
	'isNegative':        s => scalarCheck(s, n => n < 0),
	/** `< 0` */
	'isPositive':        s => scalarCheck(s, n => n > 0),
	/** `>= 0` */
	'isNonNegative':     s => scalarCheck(s, n => n >= 0),
	'isMarkedAsInt':     scalarMarkedAsInt,
	'isMarkedAsComplex': scalarMarkedAsComplex
} as const satisfies Record<string, (a: Lift<ValueNumber>) => Value>;

export type ScalarUnaryOperation = keyof typeof ScalarUnaryOperations;

function scalarHelper(a: Lift<ValueNumber>, op: (a: number) => number, fallback: Value = Top): Value {
	if(isTop(a)) {
		return fallback;
	} else if(isBottom(a)) {
		return a;
	}
	const val = bottomTopGuard(a.value);
	const aval = a.value as RNumberValue;
	return liftScalar(val ?? {
		markedAsInt:   aval.markedAsInt,
		complexNumber: aval.complexNumber,
		num:           op(aval.num)
	});
}


function scalarCheck(a: Lift<ValueNumber>, c: (n: number) => boolean): ValueLogical {
	const val = bottomTopGuard(a);
	if(val) {
		return val === Bottom ? ValueLogicalBot : ValueLogicalTop;
	}
	a = asValue(a);
	if(isTop(a.value)) {
		return ValueLogicalTop;
	} else if(isBottom(a.value)) {
		return ValueLogicalBot;
	} else {
		return liftLogical(c(a.value.num));
	}
}

function scalarMarkedAsInt(a: Lift<ValueNumber>): Lift<ValueLogical> {
	if(isBottom(a)) {
		return ValueLogicalBot;
	} else if(isTop(a)) {
		return ValueLogicalTop;
	}
	a = asValue(a);
	if(isTop(a.value)) {
		return ValueLogicalTop;
	} else if(isBottom(a.value)) {
		return ValueLogicalBot;
	} else {
		return liftLogical(a.value.markedAsInt);
	}
}

function scalarMarkedAsComplex(a: Lift<ValueNumber>): Lift<ValueLogical> {
	if(isBottom(a)) {
		return ValueLogicalBot;
	} else if(isTop(a)) {
		return ValueLogicalTop;
	}
	a = asValue(a);
	if(isTop(a.value)) {
		return ValueLogicalTop;
	} else if(isBottom(a.value)) {
		return ValueLogicalBot;
	} else {
		return liftLogical(a.value.complexNumber);
	}
}

