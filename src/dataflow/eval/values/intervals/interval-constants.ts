import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';
import { type Lift, type ValueInterval, type ValueNumber , isBottom, isTop } from '../r-value';
import { getScalarFromInteger, liftScalar } from '../scalar/scalar-constants';


/**
 *
 */
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


/**
 *
 */
export function intervalFromValues(start: Lift<ValueNumber>, end = start, startInclusive = true, endInclusive = true): ValueInterval {
	return {
		type:  'interval',
		start: shiftNum(start),
		end:   shiftNum(end),
		startInclusive,
		endInclusive,
	};
}
