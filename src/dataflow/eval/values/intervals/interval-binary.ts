import type { ValueInterval } from '../r-value';
import { isBottom } from '../r-value';
import { binaryScalar } from '../scalar/scalar-binary';
import { ValueIntervalBottom, orderIntervalFrom, ValueIntervalZero, ValueIntervalTop } from './interval-constants';
import { binaryLogical } from '../logical/logical-binary';
import { compareInterval } from './interval-compare';
import { iteLogical } from '../logical/logical-check';
import { unaryInterval } from './interval-unary';

/**
 * Take two potentially lifted intervals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryInterval<A extends ValueInterval, B extends ValueInterval>(
	a: A,
	op: keyof typeof Operations,
	b: B
): ValueInterval {
	// TODO: improve handling of open intervals
	a = unaryInterval(a, 'toClosed') as A;
	b = unaryInterval(b, 'toClosed') as B;
	return Operations[op](a as ValueInterval, b as ValueInterval);
}

const Operations = {
	add:       intervalAdd,
	sub:       intervalSub,
	mul:       intervalMul,
	div:       intervalDiv,
	intersect: intervalIntersect,
	union:     intervalUnion,
	setminus:  intervalSetminus
} as const;

function intervalAdd<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	return orderIntervalFrom(
		binaryScalar(a.start, 'add', b.start),
		binaryScalar(a.end, 'add', b.end),
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

function intervalSub<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	return orderIntervalFrom(
		binaryScalar(a.start, 'sub', b.end),
		binaryScalar(a.end, 'sub', b.start),
		a.startInclusive && b.endInclusive,
		a.endInclusive && b.startInclusive
	);
}

function intervalIntersect<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	return orderIntervalFrom(
		binaryScalar(a.start, 'max', b.start),
		binaryScalar(a.end, 'min', b.end),
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

function intervalUnion<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	return orderIntervalFrom(
		binaryScalar(a.start, 'min', b.start),
		binaryScalar(a.end, 'max', b.end),
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}


function intervalSetminus<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	return orderIntervalFrom(
		binaryScalar(a.start, 'max', b.end),
		binaryScalar(a.end, 'min', b.start),
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

function intervalMul<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	if(isBottom(a.start.value) || isBottom(b.start.value) || isBottom(a.end.value) || isBottom(b.end.value)) {
		return ValueIntervalBottom;
	}

	const ll = binaryScalar(a.start, 'mul', b.start);
	const lu = binaryScalar(a.start, 'mul', b.end);
	const ul = binaryScalar(a.end, 'mul', b.start);
	const uu = binaryScalar(a.end, 'mul', b.end);

	return orderIntervalFrom(
		[ll, lu, ul, uu].reduce((acc, val) => binaryScalar(acc, 'min', val)),
		[ll, lu, ul, uu].reduce((acc, val) => binaryScalar(acc, 'max', val)),
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

// TODO: take support for div sin and other functions that i wrote

function intervalDiv<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	// if both are zero switch to bot
	const bothAreZero = binaryLogical(
		compareInterval(a, '===', ValueIntervalZero),
		'and',
		compareInterval(b, '===', ValueIntervalZero));

	const calcWithPotentialZero = () =>
		binaryInterval(a, 'mul', unaryInterval(b, 'flip'));

	return iteLogical(
		bothAreZero,
		{
			onTrue:   ValueIntervalBottom,
			onMaybe:  calcWithPotentialZero,
			onFalse:  calcWithPotentialZero,
			onTop:    ValueIntervalTop,
			onBottom: ValueIntervalBottom
		}
	);

}