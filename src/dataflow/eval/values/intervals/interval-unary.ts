import type { Lift, Value, ValueInterval, ValueLogical, ValueNumber } from '../r-value';
import { isBottom , Top , isTop ,   asValue } from '../r-value';
import type { ScalarUnaryOperation } from '../scalar/scalar-unary';
import { unaryScalar } from '../scalar/scalar-unary';
import {
	intervalFromValues,
	ValueIntervalTop,
	orderIntervalFrom,
	ValueIntervalBottom,
	ValuePositiveInfinite,
	ValueIntervalMinusOneToOne,
	ValueIntervalZero,
	ValueIntervalZeroToPositiveInfinity
} from './interval-constants';
import { iteLogical } from '../logical/logical-check';
import { binaryScalar } from '../scalar/scalar-binary';
import {
	ValueIntegerNegativeInfinity,
	ValueIntegerOne,
	ValueIntegerPositiveInfinity,
	ValueIntegerZero, ValueNumberEpsilon
} from '../scalar/scalar-constants';
import { liftLogical, ValueLogicalBot, ValueLogicalFalse, ValueLogicalTop } from '../logical/logical-constants';
import { binaryInterval } from './interval-binary';
import { bottomTopGuard } from '../general';
import { binaryValue } from '../value-binary';

/**
 * Take two potentially lifted intervals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function unaryInterval(
	a: Lift<ValueInterval>,
	op: keyof typeof Operations
): Value {
	if(op in Operations) {
		return Operations[op](a);
	} else {
		return Top;
	}
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
	sign:   intervalSign,
	/** calculates 1/x */
	flip:   intervalDivByOne,
	/** returns the structural minimum of the interval, if it is exclusive, we use the closest eta-value */
	lowest: a => {
		const bt = bottomTopGuard(a);
		if(bt) {
			return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
		}
		a = asValue(a);
		const min = a.startInclusive ? a.start : binaryScalar(a.start, 'add', ValueNumberEpsilon) as ValueNumber;
		return intervalFromValues(min, min, true, true);
	},
	/** returns the structural maximum of the interval, if it is exclusive, we use the closest eta-value */
	highest: a => {
		const bt = bottomTopGuard(a);
		if(bt) {
			return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
		}
		a = asValue(a);
		const max = a.endInclusive ? a.end : binaryScalar(a.end, 'sub', ValueNumberEpsilon) as ValueNumber;
		return intervalFromValues(max, max, true, true);
	},
	/** essentially returns [lowest(v), highest(v)] */
	toClosed: a => {
		const bt = bottomTopGuard(a);
		if(bt) {
			return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
		}
		a = asValue(a);
		const min = a.startInclusive ? a.start : binaryScalar(a.start, 'add', ValueNumberEpsilon) as ValueNumber;
		const max = a.endInclusive ? a.end : binaryScalar(a.end, 'sub', ValueNumberEpsilon) as ValueNumber;
		return intervalFromValues(min, max, true, true);
	},
	/** check if the interval contains no values */
	empty:   intervalEmpty,
	/** check if the interval contains exactly one value */
	scalar:  intervalScalar,
	hasZero: a => binaryInterval(ValueIntervalZero, '⊆', a)
} as const satisfies Record<string, (a: Lift<ValueInterval>) => Value>;


function intervalApplyBoth(a: Lift<ValueInterval>, op: ScalarUnaryOperation, toClosed: boolean, startInclusive?: boolean, endInclusive?: boolean): ValueInterval {
	const bt = bottomTopGuard(a);
	if(bt) {
		return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
	}
	a = asValue(a);
	if(toClosed) {
		a = asValue(unaryInterval(a, 'toClosed') as Lift<ValueInterval>);
		startInclusive = true;
		endInclusive = true;
	}

	return orderIntervalFrom(
		unaryScalar(a.start, op) as ValueNumber,
		unaryScalar(a.end, op) as ValueNumber,
		startInclusive ?? a.startInclusive,
		endInclusive ?? a.endInclusive
	);
}

function intervalSign(a: Lift<ValueInterval>): ValueInterval {
	if(isBottom(a)) {
		return ValueIntervalBottom;
	} else if(isTop(a) || isTop(a.start.value) || isTop(a.end.value)) {
		return ValueIntervalMinusOneToOne;
	}

	return intervalApplyBoth(a, 'sign', true);
}

function intervalNegate(a: Lift<ValueInterval>): ValueInterval {
	const bt = bottomTopGuard(a);
	if(bt) {
		return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
	}
	const x = asValue(a);
	return intervalFromValues(
		unaryScalar(x.end, 'negate') as ValueNumber,
		unaryScalar(x.start, 'negate') as ValueNumber,
		x.endInclusive,
		x.startInclusive
	);
}

function intervalAbs(a: Lift<ValueInterval>): ValueInterval {
	if(isBottom(a)) {
		return ValueIntervalBottom;
	} else if(isTop(a)) {
		return ValueIntervalZeroToPositiveInfinity;
	}
	// abs[a,b] = [0, max(abs(a), abs(b))] if a <= 0 <= b
	// abs[a,b] = [a, b] if 0 <= a <= b
	// abs[a,b] = [abs(b), abs(a)] if a <= b <= 0
	return iteLogical(
		unaryScalar(a.start, 'isNegative'),
		{
			onTrue: () => iteLogical(
				unaryScalar(a.end, 'isNonNegative'),
				{
					// a <= 0 <= b
					onTrue: () => {
						const startAbs = unaryScalar(a.start, 'abs') as ValueNumber;
						const endAbs = unaryScalar(a.end, 'abs') as ValueNumber;
						const max = binaryScalar(
							startAbs,
							'max',
							endAbs
						)  as ValueNumber;
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
						unaryScalar(a.end, 'abs') as ValueNumber,
						unaryScalar(a.start, 'abs') as ValueNumber,
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

function intervalDivByOne(a: Lift<ValueInterval>): ValueInterval {
	const bt = bottomTopGuard(a);
	if(bt) {
		return bt === Top ? ValueIntervalTop : ValueIntervalBottom;
	}
	a = asValue(a);
	const ifStartIsZero = () =>
		iteLogical(unaryScalar(a.end, 'isZero'),
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
		unaryInterval(a, 'hasZero'),
		{
			onTrue:  ValueIntervalTop,
			onTop:   ValueIntervalTop,
			onFalse: () => orderIntervalFrom(
				binaryScalar(ValueIntegerOne, 'div', a.start) as ValueNumber,
				binaryScalar(ValueIntegerOne, 'div', a.end) as ValueNumber,
				a.startInclusive, // TODO: check
				a.endInclusive // TODO: check
			),
			onMaybe:  ValueIntervalTop,
			onBottom: ValueIntervalBottom
		}
	);
	const ifStartIsNotZero = () => iteLogical(
		unaryScalar(a.end, 'isZero'),
		{
			// start is not zero, but end is zero
			onTrue: () => intervalFromValues(
				ValueIntegerNegativeInfinity,
				binaryScalar(ValueIntegerOne, 'div', a.end) as ValueNumber,
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
		unaryScalar(a.start, 'isZero'),
		{
			onTrue:   ifStartIsZero,
			onFalse:  ifStartIsNotZero,
			onMaybe:  ValueIntervalTop,
			onTop:    ValueIntervalTop,
			onBottom: ValueIntervalBottom
		}
	);
}

function intervalEmpty(a: Lift<ValueInterval>): ValueLogical {
	const bt = bottomTopGuard(a);
	if(bt) {
		return bt === Top ? ValueLogicalTop : ValueLogicalBot;
	}
	a = asValue(a);
	return binaryValue(
		binaryScalar(a.start, '>', a.end),
		'or',
		binaryValue(
			binaryScalar(a.start, '===', a.end),
			'and',
			liftLogical(!a.startInclusive || !a.endInclusive)
		)
	) as ValueLogical;
}

function intervalScalar(a: Lift<ValueInterval>): ValueLogical {
	const bt = bottomTopGuard(a);
	if(bt) {
		return bt === Top ? ValueLogicalTop : ValueLogicalBot;
	}
	a = asValue(a);
	if(!a.startInclusive || !a.endInclusive) {
		return ValueLogicalFalse;
	} else {
		return binaryScalar(a.start, '===', a.end) as ValueLogical;
	}
}

