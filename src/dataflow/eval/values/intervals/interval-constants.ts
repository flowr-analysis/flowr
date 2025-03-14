import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';
import type { Lift, ValueInterval, ValueNumber } from '../r-value';
import { bottomTopGuard } from '../general';
import { getScalarFromInteger, liftScalar } from '../scalar/scalar-constants';
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

export function intervalFromValues(start: Lift<ValueNumber>, end = start, startInclusive = true, endInclusive = true): ValueInterval {
	return {
		type: 'interval',
		start,
		end,
		startInclusive,
		endInclusive,
	};
}

export function orderIntervalFrom(start: Lift<ValueNumber>, end = start, startInclusive = true, endInclusive = true): Lift<ValueInterval> {
	return iteLogical(
		compareScalar(start, end, '<='),
		intervalFromValues(start, end, startInclusive, endInclusive),
		intervalFromValues(end, start, startInclusive, endInclusive)
	);
}

export function getIntervalStart(interval: Lift<ValueInterval>): Lift<ValueNumber> {
	return applyIntervalOp(interval, op => op.start);
}

export function getIntervalEnd(interval: Lift<ValueInterval>): Lift<ValueNumber> {
	return applyIntervalOp(interval, op => op.end);
}

function applyIntervalOp<Out>(interval: Lift<ValueInterval>, op: (interval: ValueInterval) => Lift<Out>): Lift<Out> {
	return bottomTopGuard(interval) ?? op(interval as ValueInterval);
}