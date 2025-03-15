import type { ValueInterval, ValueLogical } from '../r-value';
import { isBottom, isTop } from '../r-value';
import { checkInterval } from './interval-check';
import { binaryInterval } from './interval-binary';
import { iteLogical } from '../logical/logical-check';
import {
	liftLogical,
	ValueLogicalBot,
	ValueLogicalFalse,
	ValueLogicalMaybe,
	ValueLogicalTrue
} from '../logical/logical-constants';
import { compareScalar } from '../scalar/scalar-compare';
import { getIntervalEnd, getIntervalStart } from './interval-constants';
import { binaryLogical } from '../logical/logical-binary';
import { unaryLogical } from '../logical/logical-unary';
import type { ValueCompareOperation } from '../value-compare';

const CompareOperations = {
	'<':   (a, b) => intervalLower(a, b, '<'),
	'>':   (a, b) => intervalLower(b, a, '<'),
	'<=':  (a, b) => intervalLower(a, b, '<='),
	'>=':  (a, b) => intervalLower(b, a, '<='),
	'!==': (a, b) => unaryLogical(compareInterval(a, '===', b), 'not'),
	/** checks if the bounds are identical (structurally) */
	'===': intervalIdentical,
	/** checks if the values described by the intervals can be equal */
	'==':  intervalEqual,
	'!=':  (a, b) => unaryLogical(compareInterval(a, '==', b), 'not'),
	/** structural subset eq comparison! **/
	'⊆':   (a, b) => intervalSubset(a, b, '⊆'),
	/** structural subset comparison! **/
	'⊂':   (a, b) => intervalSubset(a, b, '⊂'),
	/** structural superset comparison! **/
	'⊃':   (a, b) => intervalSubset(b, a, '⊂'),
	/** structural superset eq comparison! **/
	'⊇':   (a, b) => intervalSubset(b, a, '⊆'),
} as const as Record<ValueCompareOperation, (a: ValueInterval, b: ValueInterval) => ValueLogical>;

export function compareInterval<A extends ValueInterval, B extends ValueInterval>(a: A, op: ValueCompareOperation, b: B): ValueLogical {
	return CompareOperations[op](a, b);
}

function intervalLower<A extends ValueInterval, B extends ValueInterval>(a: A, b: B, op: '<' | '<='): ValueLogical {
	// if intersect af a and b is non-empty, return maybe
	// else return a.end <= b.start
	const intersect = binaryInterval(a, 'intersect', b);

	// TODO: < case if one is inclusive and the other isn't
	return iteLogical(
		checkInterval(intersect, 'empty'),
		{
			onTrue:   () => compareScalar(getIntervalEnd(a), op, getIntervalStart(b)),
			onFalse:  ValueLogicalMaybe,
			onMaybe:  ValueLogicalMaybe,
			onTop:    ValueLogicalMaybe,
			onBottom: ValueLogicalBot
		}
	);
}

function intervalSubset<A extends ValueInterval, B extends ValueInterval>(a: A, b: B, op: '⊂' | '⊆'): ValueLogical {
	// check if a.start >= b.start and a.end <= b.end (or a.start > b.start || a.end < b.end if not inclusive)
	// hence we check for the interval not beign the same in the '⊂' case

	return iteLogical(
		compareScalar(getIntervalStart(a), '>=', getIntervalStart(b)),
		{
			onTrue: () =>
				iteLogical(compareScalar(getIntervalEnd(a), '<=', getIntervalEnd(b)), {
					onTrue:   op === '⊂' ? compareInterval(a, '!==', b) : ValueLogicalTrue,
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

function intervalEqual<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueLogical {
	// check if the interval describes a scalar value and if so, check whether the scalar values are equal
	// if intersect af a and b is non-empty, return maybe
	// else return false because they can never be equal
	const intersect = binaryInterval(a, 'intersect', b);

	const areBothScalar = () =>
		iteLogical(
			binaryLogical(checkInterval(a, 'scalar'), 'and', checkInterval(b, 'scalar')),
			{
				onTrue:   ValueLogicalTrue, // they intersect and they are both scalar
				onFalse:  ValueLogicalFalse,
				onMaybe:  ValueLogicalMaybe,
				onTop:    ValueLogicalMaybe,
				onBottom: ValueLogicalBot
			}
		);

	return iteLogical(
		checkInterval(intersect, 'empty'),
		{
			onTrue:   ValueLogicalFalse, // if they don't intersect, they can never be equal
			onFalse:  areBothScalar,
			onMaybe:  ValueLogicalMaybe,
			onTop:    ValueLogicalMaybe,
			onBottom: ValueLogicalBot
		}
	);
}

function intervalIdentical<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): ValueLogical {
	// check if start, end, and inclusivity is identical
	if(
		isTop(a) || isTop(b) || isBottom(a) || isBottom(b)
	) {
		return liftLogical(
			a.start === b.start &&
			a.end === b.end &&
			a.startInclusive === b.startInclusive &&
			a.endInclusive === b.endInclusive
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
			binaryLogical(
				compareScalar(getIntervalStart(a), '===', getIntervalStart(b)),
				'and',
				compareScalar(getIntervalEnd(a), '===', getIntervalEnd(b))
			) : ValueLogicalFalse;
	}
}