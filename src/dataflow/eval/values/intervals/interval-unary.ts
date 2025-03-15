import type { Lift, ValueInterval } from '../r-value';
import {   asValue } from '../r-value';
import type { ScalarUnaryOperation } from '../scalar/scalar-unary';
import { unaryScalar } from '../scalar/scalar-unary';
import {
	intervalFromValues,
	ValueIntervalTop,
	orderIntervalFrom,
	ValueIntervalBottom, ValuePositiveInfinite
} from './interval-constants';
import { iteLogical } from '../logical/logical-check';
import { checkScalar } from '../scalar/scalar-check';
import { binaryScalar } from '../scalar/scalar-binary';
import {
	ValueIntegerNegativeInfinity,
	ValueIntegerOne,
	ValueIntegerPositiveInfinity,
	ValueIntegerZero, ValueNumberEpsilon
} from '../scalar/scalar-constants';
import { checkInterval } from './interval-check';


/**
 * Take two potentially lifted intervals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function unaryInterval<A extends ValueInterval>(
	a: A,
	op: keyof typeof Operations
): ValueInterval {
	return Operations[op](a as ValueInterval);
}

// TODO: sin, cos, tan, ...

/** every operation returns the interval describing all possible results when applying the operation to any value in the input interval */
const Operations = {
	id:     a => a,
	negate: intervalNegate,
	abs:    intervalAbs,
	ceil:   a => intervalApplyBoth(a, 'ceil', true),
	floor:  a => intervalApplyBoth(a, 'floor', true),
	round:  a => intervalApplyBoth(a, 'round', true),
	// TODO: sign does not propagate top but returns [-1, 1]!
	sign:   a => intervalApplyBoth(a, 'sign', true),
	/** calculates 1/x */
	flip:   intervalDivByOne,
	/** returns the structural minimum of the interval, if it is exclusive, we use the closest eta-value */
	lowest: a => {
		const min = a.startInclusive ? a.start : binaryScalar(a.start, 'add', ValueNumberEpsilon);
		return intervalFromValues(min, min, true, true);
	},
	/** returns the structural maximum of the interval, if it is exclusive, we use the closest eta-value */
	highest: a => {
		const max = a.endInclusive ? a.end : binaryScalar(a.end, 'sub', ValueNumberEpsilon);
		return intervalFromValues(max, max, true, true);
	},
	/** essentially returns [lowest(v), highest(v)] */
	toClosed: a => {
		const min = a.startInclusive ? a.start : binaryScalar(a.start, 'add', ValueNumberEpsilon);
		const max = a.endInclusive ? a.end : binaryScalar(a.end, 'sub', ValueNumberEpsilon);
		return intervalFromValues(min, max, true, true);
	},
} as const satisfies Record<string, (a: ValueInterval) => Lift<ValueInterval>>;


function intervalApplyBoth<A extends ValueInterval>(a: A, op: ScalarUnaryOperation, toClosed: boolean, startInclusive = a.startInclusive, endInclusive = a.endInclusive): ValueInterval {
	if(toClosed) {
		a = asValue(unaryInterval(a, 'toClosed')) as A;
		startInclusive = true;
		endInclusive = true;
	}

	return orderIntervalFrom(
		unaryScalar(a.start, op),
		unaryScalar(a.end, op),
		startInclusive,
		endInclusive
	);
}

function intervalNegate<A extends ValueInterval>(a: A): ValueInterval {
	return intervalFromValues(
		unaryScalar(a.end, 'negate'),
		unaryScalar(a.start, 'negate'),
		a.endInclusive,
		a.startInclusive
	);
}

function intervalAbs<A extends ValueInterval>(a: A): ValueInterval {
	// abs[a,b] = [0, max(abs(a), abs(b))] if a <= 0 <= b
	// abs[a,b] = [a, b] if 0 <= a <= b
	// abs[a,b] = [abs(b), abs(a)] if a <= b <= 0
	return iteLogical(
		checkScalar(a.start, 'isNegative'),
		{
			onTrue: () => iteLogical(
				checkScalar(a.end, 'isNonNegative'),
				{
					// a <= 0 <= b
					onTrue: () => {
						const startAbs = unaryScalar(a.start, 'abs');
						const endAbs = unaryScalar(a.end, 'abs');
						const max = binaryScalar(
							startAbs,
							'max',
							endAbs
						);
						// we take the inclusivity of the max
						const upperInclusive = max === startAbs ? a.startInclusive : a.endInclusive;
						return intervalFromValues(
							ValueIntegerZero,
							max,
							true, // TODO: check
							upperInclusive // TODO: check
						);
					},
					// a <= b <= 0
					onFalse: () => intervalFromValues(
						unaryScalar(a.end, 'abs'),
						unaryScalar(a.start, 'abs'),
						a.endInclusive,
						true // TODO: check
					),
					onMaybe:  ValuePositiveInfinite,
					onTop:    ValuePositiveInfinite,
					onBottom: ValueIntervalBottom
				}
			),
			onMaybe:  ValueIntervalTop,
			onTop:    ValueIntervalTop,
			onBottom: ValueIntervalBottom,
			onFalse:  () => a
		}
	);
}

function intervalDivByOne<A extends ValueInterval>(a: A): ValueInterval {
	const ifStartIsZero = () =>
		iteLogical(checkScalar(a.end, 'isZero'),
			{
				onTrue:  ValueIntervalBottom,
				onMaybe: ValueIntervalTop,
				onFalse: () => intervalFromValues(
					ValueIntegerNegativeInfinity,
					ValueIntegerPositiveInfinity,
					false, // TODO: check
					true // TODO: check
				),
				onTop:    ValueIntervalTop,
				onBottom: ValueIntervalBottom
			});
	const neitherIsZero = () => iteLogical(
		checkInterval(a, 'hasZero'),
		{
			onTrue:  ValueIntervalTop,
			onTop:   ValueIntervalTop,
			onFalse: () => orderIntervalFrom(
				binaryScalar(ValueIntegerOne, 'div', a.start),
				binaryScalar(ValueIntegerOne, 'div', a.end),
				a.startInclusive, // TODO: check
				a.endInclusive // TODO: check
			),
			onMaybe:  ValueIntervalTop,
			onBottom: ValueIntervalBottom
		}
	);
	const ifStartIsNotZero = () => iteLogical(
		checkScalar(a.end, 'isZero'),
		{
			// start is not zero, but end is zero
			onTrue: () => intervalFromValues(
				ValueIntegerNegativeInfinity,
				binaryScalar(ValueIntegerOne, 'div', a.end),
				false, // TODO: check
				true // TODO: check
			),
			onMaybe:  ValueIntervalTop,
			onFalse:  neitherIsZero,
			onTop:    ValueIntervalTop,
			onBottom: ValueIntervalBottom
		}
	);

	return iteLogical(
		checkScalar(a.start, 'isZero'),
		{
			onTrue:   ifStartIsZero,
			onFalse:  ifStartIsNotZero,
			onMaybe:  ValueIntervalTop,
			onTop:    ValueIntervalTop,
			onBottom: ValueIntervalBottom
		}
	);
}
