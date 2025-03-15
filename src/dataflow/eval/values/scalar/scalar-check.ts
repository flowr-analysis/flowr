import type { Lift, ValueLogical, ValueNumber } from '../r-value';
import { isBottom, isTop } from '../r-value';
import { liftLogical, ValueLogicalBot, ValueLogicalTop } from '../logical/logical-constants';
import { bottomTopGuard } from '../general';

const ScalarCheckOperations = {
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
} as const satisfies Record<string, (a: ValueNumber) => Lift<ValueLogical>>;

export function checkScalar<A extends Lift<ValueNumber>>(a: A, op: keyof typeof ScalarCheckOperations): Lift<ValueLogical> {
	return bottomTopGuard(a) ?? ScalarCheckOperations[op](a as ValueNumber);
}

function scalarCheck<A extends ValueNumber>(a: A, c: (n: number) => boolean): ValueLogical {
	if(isTop(a.value)) {
		return ValueLogicalTop;
	} else if(isBottom(a.value)) {
		return ValueLogicalBot;
	} else {
		return liftLogical(c(a.value.num));
	}
}

function scalarMarkedAsInt<A extends ValueNumber>(a: A): ValueLogical {
	if(isTop(a.value)) {
		return ValueLogicalTop;
	} else if(isBottom(a.value)) {
		return ValueLogicalBot;
	} else {
		return liftLogical(a.value.markedAsInt);
	}
}

function scalarMarkedAsComplex<A extends ValueNumber>(a: A): ValueLogical {
	if(isTop(a.value)) {
		return ValueLogicalTop;
	} else if(isBottom(a.value)) {
		return ValueLogicalBot;
	} else {
		return liftLogical(a.value.complexNumber);
	}
}

