import type { Lift, ValueInterval } from '../r-value';
import { bottomTopGuard } from '../general';
import { binaryScalar } from '../scalar/scalar-binary';

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
	intersect: intervalIntersect,
	union:     intervalUnion,
	setminus:  intervalSetminus
} as const;

function intervalAdd<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	return {
		type:           'interval',
		startInclusive: a.startInclusive && b.startInclusive,
		start:          binaryScalar(a.start, b.start, 'add'),
		endInclusive:   a.endInclusive && b.endInclusive,
		end:            binaryScalar(a.end, b.end, 'add')
	};
}

function intervalSub<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	return {
		type:           'interval',
		startInclusive: a.startInclusive && b.startInclusive,
		start:          binaryScalar(a.start, b.end, 'sub'),
		endInclusive:   a.endInclusive && b.endInclusive,
		end:            binaryScalar(a.end, b.start, 'sub')
	};
}

function intervalIntersect<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	return {
		type:           'interval',
		startInclusive: a.startInclusive && b.startInclusive,
		start:          binaryScalar(a.start, b.start, 'max'),
		endInclusive:   a.endInclusive && b.endInclusive,
		end:            binaryScalar(a.end, b.end, 'min')
	};
}

function intervalUnion<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	return {
		type:           'interval',
		startInclusive: a.startInclusive && b.startInclusive,
		start:          binaryScalar(a.start, b.start, 'min'),
		endInclusive:   a.endInclusive && b.endInclusive,
		end:            binaryScalar(a.end, b.end, 'max')
	};
}

function intervalSetminus<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueInterval {
	return {
		type:           'interval',
		startInclusive: a.startInclusive && b.startInclusive,
		start:          binaryScalar(a.start, b.end, 'max'),
		endInclusive:   a.endInclusive && b.endInclusive,
		end:            binaryScalar(a.end, b.start, 'min')
	};
}