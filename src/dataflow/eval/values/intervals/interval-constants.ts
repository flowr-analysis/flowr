import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';
import type { Lift, ValueInterval, ValueNumber } from '../r-value';
import { isBottom, isTop } from '../r-value';
import {
	getScalarFromInteger,
	liftScalar,
	ValueIntegerBottom, ValueIntegerPositiveInfinity,
	ValueIntegerTop, ValueIntegerZero
} from '../scalar/scalar-constants';
import { iteLogical } from '../logical/logical-check';
import { binaryScalar } from '../scalar/scalar-binary';
import { bottomTopGuard } from '../general';

export function intervalFrom(start: RNumberValue | number, end = start, startInclusive = true, endInclusive = true): ValueInterval {
	return intervalFromValues(
		typeof start === 'number' ? getScalarFromInteger(start) : liftScalar(start),
		typeof end === 'number' ? getScalarFromInteger(end) : liftScalar(end),
		startInclusive,
		endInclusive
	);
}

function shiftNum(v: Lift<ValueNumber>): ValueNumber {
	if(isBottom(v) || isTop(v)) {
		return liftScalar(v);
	} else {
		return v;
	}
}

export function intervalFromValues(start: Lift<ValueNumber>, end = start, startInclusive = true, endInclusive = true): ValueInterval {
	return {
		type:  'interval',
		start: shiftNum(start),
		end:   shiftNum(end),
		startInclusive,
		endInclusive,
	};
}

export function orderIntervalFrom(start: Lift<ValueNumber>, end = start, startInclusive = true, endInclusive = true): ValueInterval {
	const onTrue = () => intervalFromValues(start, end, startInclusive, endInclusive);
	return iteLogical(
		binaryScalar(start, '<=', end),
		{
			onTrue,
			onMaybe:  onTrue,
			onFalse:  () => intervalFromValues(end, start, endInclusive, startInclusive),
			onTop:    ValueIntervalTop,
			onBottom: ValueIntervalBottom
		}
	);
}

export function getIntervalStart(interval: Lift<ValueInterval>): Lift<ValueNumber> {
	return bottomTopGuard(interval) ?? (interval as ValueInterval).start;
}

export function getIntervalEnd(interval: Lift<ValueInterval>): Lift<ValueNumber> {
	return bottomTopGuard(interval) ?? (interval as ValueInterval).end;
}

export const ValueIntervalZero = intervalFrom(0);
export const ValueIntervalOne = intervalFrom(1);
export const ValueIntervalNegativeOne = intervalFrom(-1);
export const ValueIntervalZeroToOne = intervalFrom(0, 1);
export const ValueIntervalZeroToPositiveInfinity = intervalFromValues(ValueIntegerZero, ValueIntegerPositiveInfinity, true, false);
export const ValueIntervalMinusOneToOne = intervalFrom(-1, 1);
export const ValueIntervalTop = intervalFromValues(ValueIntegerTop, ValueIntegerTop);
export const ValueIntervalBottom = intervalFromValues(ValueIntegerBottom, ValueIntegerBottom);
