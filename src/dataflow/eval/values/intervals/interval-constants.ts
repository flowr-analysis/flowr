import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';
import type { ValueInterval, ValueNumber } from '../r-value';
import {
	getScalarFromInteger,
	liftScalar,
	ValueIntegerBottom, ValueIntegerPositiveInfinity,
	ValueIntegerTop, ValueIntegerZero
} from '../scalar/scalar-constants';
import { iteLogical } from '../logical/logical-check';
import { compareScalar } from '../scalar/scalar-compare';

export function intervalFrom(start: RNumberValue | number, end = start, startInclusive = true, endInclusive = true): ValueInterval {
	return intervalFromValues(
		typeof start === 'number' ? getScalarFromInteger(start) : liftScalar(start),
		typeof end === 'number' ? getScalarFromInteger(end) : liftScalar(end),
		startInclusive,
		endInclusive
	);
}

export function intervalFromValues(start: ValueNumber, end = start, startInclusive = true, endInclusive = true): ValueInterval {
	return {
		type: 'interval',
		start,
		end,
		startInclusive,
		endInclusive,
	};
}

export function orderIntervalFrom(start: ValueNumber, end = start, startInclusive = true, endInclusive = true): ValueInterval {
	const onTrue = () => intervalFromValues(start, end, startInclusive, endInclusive);
	return iteLogical(
		compareScalar(start, '<=', end),
		{
			onTrue,
			onMaybe:  onTrue,
			onFalse:  () => intervalFromValues(end, start, endInclusive, startInclusive),
			onTop:    ValueIntervalTop,
			onBottom: ValueIntervalBottom
		}
	);
}

export function getIntervalStart(interval: ValueInterval): ValueNumber {
	return interval.start;
}

export function getIntervalEnd(interval: ValueInterval): ValueNumber {
	return interval.end;
}

export const ValueIntervalZero = intervalFrom(0);
export const ValueIntervalOne = intervalFrom(1);
export const ValueIntervalNegativeOne = intervalFrom(-1);
export const ValueIntervalZeroToOne = intervalFrom(0, 1);
export const ValueIntervalMinusOneToOne = intervalFrom(-1, 1);
export const ValueIntervalTop = intervalFromValues(ValueIntegerTop, ValueIntegerTop);
export const ValueIntervalBottom = intervalFromValues(ValueIntegerBottom, ValueIntegerBottom);
export const ValuePositiveInfinite = intervalFromValues(ValueIntegerZero, ValueIntegerPositiveInfinity, false);