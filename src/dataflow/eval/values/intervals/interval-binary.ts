import type { Lift, Value, ValueInterval, ValueNumber } from '../r-value';
import { Top , isTop , isBottom } from '../r-value';
import { binaryScalar } from '../scalar/scalar-binary';
import {
	ValueIntervalBottom,
	orderIntervalFrom,
	ValueIntervalZero,
	ValueIntervalTop,
	getIntervalEnd, getIntervalStart
} from './interval-constants';
import { iteLogical } from '../logical/logical-check';
import { unaryInterval } from './interval-unary';
import {
	liftLogical,
	ValueLogicalBot,
	ValueLogicalFalse,
	ValueLogicalMaybe,
	ValueLogicalTrue
} from '../logical/logical-constants';
import { bottomTopGuard } from '../general';
import { unaryValue } from '../value-unary';
import { binaryValue } from '../value-binary';

/**
 * Take two potentially lifted intervals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryInterval(
	a: Lift<ValueInterval>,
	op: string,
	b: Lift<ValueInterval>
): Value {
	if(op in Operations) {
		return Operations[op as keyof typeof Operations](a, b);
	}
	return Top;
}

// TODO: improve handling of open intervals!
function closeBoth(a: ValueInterval, b: ValueInterval): [ValueInterval, ValueInterval] {
	return [unaryInterval(a, 'toClosed') as ValueInterval, unaryInterval(b, 'toClosed') as ValueInterval];
}

const Operations = {
	add:       intervalAdd,
	sub:       intervalSub,
	mul:       intervalMul,
	div:       intervalDiv,
	intersect: intervalIntersect,
	union:     intervalUnion,
	setminus:  intervalSetminus,
	'<':       (a, b) => intervalLower(a, b, '<'),
	'>':       (a, b) => intervalLower(b, a, '<'),
	'<=':      (a, b) => intervalLower(a, b, '<='),
	'>=':      (a, b) => intervalLower(b, a, '<='),
	'!==':     (a, b) => unaryValue(binaryValue(a, '===', b), 'not'),
	/** checks if the bounds are identical (structurally) */
	'===':     intervalIdentical,
	/** checks if the values described by the intervals can be equal */
	'==':      intervalEqual,
	'!=':      (a, b) => unaryValue(binaryValue(a, '==', b), 'not'),
	/** structural subset eq comparison! **/
	'⊆':       (a, b) => intervalSubset(a, b, '⊆'),
	/** structural subset comparison! **/
	'⊂':       (a, b) => intervalSubset(a, b, '⊂'),
	/** structural superset comparison! **/
	'⊃':       (a, b) => intervalSubset(b, a, '⊂'),
	/** structural superset eq comparison! **/
	'⊇':       (a, b) => intervalSubset(b, a, '⊆'),
} as const satisfies Record<string, (a: Lift<ValueInterval>, b: Lift<ValueInterval>) => Value>;

function intervalAdd(a: Lift<ValueInterval>, b: Lift<ValueInterval>): Lift<ValueInterval> {
	const bt = bottomTopGuard(a, b);
	if(bt) {
		return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
	}
	[a, b] = closeBoth(a as ValueInterval, b as ValueInterval);
	return orderIntervalFrom(
		binaryScalar(a.start, 'add', b.start) as ValueNumber,
		binaryScalar(a.end, 'add', b.end) as ValueNumber,
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

function intervalSub(a: Lift<ValueInterval>, b: Lift<ValueInterval>): Lift<ValueInterval> {
	const bt = bottomTopGuard(a, b);
	if(bt) {
		return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
	}
	[a, b] = closeBoth(a as ValueInterval, b as ValueInterval);
	return orderIntervalFrom(
		binaryScalar(a.start, 'sub', b.end) as ValueNumber,
		binaryScalar(a.end, 'sub', b.start) as ValueNumber,
		a.startInclusive && b.endInclusive,
		a.endInclusive && b.startInclusive
	);
}

function intervalIntersect(a: Lift<ValueInterval>, b: Lift<ValueInterval>): Lift<ValueInterval> {
	const bt = bottomTopGuard(a, b);
	if(bt) {
		return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
	}
	[a, b] = closeBoth(a as ValueInterval, b as ValueInterval);
	return orderIntervalFrom(
		binaryScalar(a.start, 'max', b.start) as ValueNumber,
		binaryScalar(a.end, 'min', b.end) as ValueNumber,
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

function intervalUnion(a: Lift<ValueInterval>, b: Lift<ValueInterval>): Lift<ValueInterval> {
	const bt = bottomTopGuard(a, b);
	if(bt) {
		return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
	}
	[a, b] = closeBoth(a as ValueInterval, b as ValueInterval);
	return orderIntervalFrom(
		binaryScalar(a.start, 'min', b.start) as ValueNumber,
		binaryScalar(a.end, 'max', b.end) as ValueNumber,
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}


function intervalSetminus(a: Lift<ValueInterval>, b: Lift<ValueInterval>): Lift<ValueInterval> {
	const bt = bottomTopGuard(a, b);
	if(bt) {
		return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
	}
	[a, b] = closeBoth(a as ValueInterval, b as ValueInterval);
	return orderIntervalFrom(
		binaryScalar(a.start, 'max', b.end) as ValueNumber,
		binaryScalar(a.end, 'min', b.start) as ValueNumber,
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

function intervalMul(a: Lift<ValueInterval>, b: Lift<ValueInterval>): Lift<ValueInterval> {
	const bt = bottomTopGuard(a, b);
	if(bt) {
		return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
	}
	[a, b] = closeBoth(a as ValueInterval, b as ValueInterval);
	if(isBottom(a.start.value) || isBottom(b.start.value) || isBottom(a.end.value) || isBottom(b.end.value)) {
		return ValueIntervalBottom;
	}

	const ll = binaryScalar(a.start, 'mul', b.start);
	const lu = binaryScalar(a.start, 'mul', b.end);
	const ul = binaryScalar(a.end, 'mul', b.start);
	const uu = binaryScalar(a.end, 'mul', b.end);

	return orderIntervalFrom(
		[ll, lu, ul, uu].reduce((acc, val) => binaryValue(acc, 'min', val)) as ValueNumber,
		[ll, lu, ul, uu].reduce((acc, val) => binaryValue(acc, 'max', val)) as ValueNumber,
		a.startInclusive && b.startInclusive,
		a.endInclusive && b.endInclusive
	);
}

// TODO: take support for div sin and other functions that i wrote

function intervalDiv(a: Lift<ValueInterval>, b: Lift<ValueInterval>): Value {
	const bt = bottomTopGuard(a, b);
	if(bt) {
		return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
	}
	[a, b] = closeBoth(a as ValueInterval, b as ValueInterval);
	// if both are zero switch to bot
	const bothAreZero = binaryValue(
		binaryInterval(a, '===', ValueIntervalZero),
		'and',
		binaryInterval(b, '===', ValueIntervalZero));

	const calcWithPotentialZero = () =>
		binaryValue(a, 'mul', unaryValue(b, 'flip'));

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

function intervalLower<A extends Lift<ValueInterval>, B extends Lift<ValueInterval>>(a: A, b: B, op: '<' | '<='): Value {
	// if intersect af a and b is non-empty, return maybe
	// else return a.end <= b.start
	const intersect = binaryInterval(a, 'intersect', b);

	// TODO: < case if one is inclusive and the other isn't
	return iteLogical(
		unaryValue(intersect, 'empty'),
		{
			onTrue:   () => binaryScalar(getIntervalEnd(a), op, getIntervalStart(b)),
			onFalse:  ValueLogicalMaybe,
			onMaybe:  ValueLogicalMaybe,
			onTop:    ValueLogicalMaybe,
			onBottom: ValueLogicalBot
		}
	);
}

function intervalSubset<A extends Lift<ValueInterval>, B extends Lift<ValueInterval>>(a: A, b: B, op: '⊂' | '⊆'): Value {
	if(isBottom(a) || isBottom(b)) {
		return ValueLogicalBot;
	}
	// check if a.start >= b.start and a.end <= b.end (or a.start > b.start || a.end < b.end if not inclusive)
	// hence we check for the interval not beign the same in the '⊂' case

	return iteLogical(
		binaryValue(getIntervalStart(a), '>=', getIntervalStart(b)),
		{
			onTrue: () =>
				iteLogical(binaryValue(getIntervalEnd(a), '<=', getIntervalEnd(b)), {
					onTrue:   op === '⊂' ? binaryScalar(a, '!==', b) : ValueLogicalTrue,
					onFalse:  ValueLogicalFalse,
					onMaybe:  ValueLogicalMaybe,
					onTop:    ValueLogicalMaybe,
					onBottom: ValueLogicalBot
				}),
			onFalse:  ValueLogicalFalse,
			onMaybe:  ValueLogicalMaybe,
			onTop:    ValueLogicalMaybe,
			onBottom: ValueLogicalBot
		}
	);
}

function intervalEqual(a: Lift<ValueInterval>, b: Lift<ValueInterval>): Value {
	// check if the interval describes a scalar value and if so, check whether the scalar values are equal
	// if intersect af a and b is non-empty, return maybe
	// else return false because they can never be equal
	const intersect = binaryValue(a, 'intersect', b);

	const areBothScalar = () =>
		iteLogical(
			binaryValue(unaryValue(a, 'scalar'), 'and', unaryValue(b, 'scalar')),
			{
				onTrue:   ValueLogicalTrue, // they intersect and they are both scalar
				onFalse:  ValueLogicalFalse,
				onMaybe:  ValueLogicalMaybe,
				onTop:    ValueLogicalMaybe,
				onBottom: ValueLogicalBot
			}
		);

	return iteLogical(
		unaryValue(intersect, 'empty'),
		{
			onTrue:   ValueLogicalFalse, // if they don't intersect, they can never be equal
			onFalse:  areBothScalar,
			onMaybe:  ValueLogicalMaybe,
			onTop:    ValueLogicalMaybe,
			onBottom: ValueLogicalBot
		}
	);
}

function intervalIdentical(a: Lift<ValueInterval>, b: Lift<ValueInterval>): Value {
	// check if start, end, and inclusivity is identical
	if(
		isTop(a) || isTop(b) || isBottom(a) || isBottom(b)
	) {
		return liftLogical(
			a === b
		);
	} else if(
		isTop(a.start.value) || isTop(b.start.value) || isBottom(a.start.value) || isBottom(b.start.value) ||
		isTop(a.end.value) || isTop(b.end.value) || isBottom(a.end.value) || isBottom(b.end.value)
	) {
		return liftLogical(
			a.start.value === b.start.value &&
			a.end.value === b.end.value &&
			a.startInclusive === b.startInclusive &&
			a.endInclusive === b.endInclusive
		);
	} else {
		return (a.startInclusive === b.startInclusive && a.endInclusive === b.endInclusive) ?
			binaryValue(
				binaryValue(getIntervalStart(a), '===', getIntervalStart(b)),
				'and',
				binaryValue(getIntervalEnd(a), '===', getIntervalEnd(b))
			) : ValueLogicalFalse;
	}
}