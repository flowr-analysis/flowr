import type { Lift, ValueInterval } from '../r-value';
import { bottomTopGuard } from '../general';
import { binaryScalar } from '../scalar/scalar-binary';
import { orderIntervalFrom } from './interval-constants';

/**
 * Take two potentially lifted intervals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryInterval<A extends Lift<ValueInterval>, B extends Lift<ValueInterval>>(
	a: A,
	b: B,
	op: keyof typeof Operations
): Lift<ValueInterval> {
	return bottomTopGuard(a, b) ?? Operations[op](a as ValueInterval, b as ValueInterval);
}

const Operations = {
	add:       intervalAdd,
	sub:       intervalSub,
	mul:       intervalMul,
	intersect: intervalIntersect,
	union:     intervalUnion,
	setminus:  intervalSetminus
} as const;

function intervalAdd<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): Lift<ValueInterval> {
	return orderIntervalFrom(
		binaryScalar(a.start, b.start, 'add'),
		binaryScalar(a.end, b.end, 'add'),
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

function intervalSub<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): Lift<ValueInterval> {
	return orderIntervalFrom(
		binaryScalar(a.start, b.end, 'sub'),
		binaryScalar(a.end, b.start, 'sub'),
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

function intervalIntersect<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): Lift<ValueInterval> {
	return orderIntervalFrom(
		binaryScalar(a.start, b.start, 'max'),
		binaryScalar(a.end, b.end, 'min'),
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

function intervalUnion<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): Lift<ValueInterval> {
	return orderIntervalFrom(
		binaryScalar(a.start, b.start, 'min'),
		binaryScalar(a.end, b.end, 'max'),
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

// TODO: take support for div sin and other functions that i wrote

function intervalSetminus<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): Lift<ValueInterval> {
	return {
		type:           'interval',
		startInclusive: a.startInclusive && b.startInclusive,
		start:          binaryScalar(a.start, b.end, 'max'),
		endInclusive:   a.endInclusive && b.endInclusive,
		end:            binaryScalar(a.end, b.start, 'min')
	};
}

function intervalMul<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): Lift<ValueInterval> {
	const ll = binaryScalar(a.start, b.start, 'mul');
	const lu = binaryScalar(a.start, b.end, 'mul');
	const ul = binaryScalar(a.end, b.start, 'mul');
	const uu = binaryScalar(a.end, b.end, 'mul');

	return {
		type:           'interval',
		startInclusive: a.startInclusive && b.startInclusive,
		start:          [ll, lu, ul, uu].reduce((acc, val) => binaryScalar(acc, val, 'min')),
		endInclusive:   a.endInclusive && b.endInclusive,
		end:            [ll, lu, ul, uu].reduce((acc, val) => binaryScalar(acc, val, 'max'))
	};
}