import { type Lift, type ValueNumber, Bottom, Top } from '../r-value';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';

/**
 * Given a (ts) number, return a scalar R number value.
 */
export function getScalarFromInteger(num: number, markedAsInt = Number.isInteger(num), complexNumber = false): ValueNumber<RNumberValue> {
	return {
		type:  'number',
		value: {
			markedAsInt,
			num,
			complexNumber
		}
	};
}


/**
 * Take a lifted R number value and wrap it into a ValueNumber.
 */
export function liftScalar(value: Lift<RNumberValue>): ValueNumber {
	return {
		type:  'number',
		value: value
	};
}

const epsilon = 1e-7;

export const ValueIntegerOne = getScalarFromInteger(1);
export const ValueNumberComplexOne = getScalarFromInteger(1, false, true);
export const ValueIntegerZero = getScalarFromInteger(0);
export const ValueIntegerNegativeOne = getScalarFromInteger(-1);
export const ValueIntegerPositiveInfinity = getScalarFromInteger(Number.POSITIVE_INFINITY);
export const ValueNumberPositiveInfinity = getScalarFromInteger(Number.POSITIVE_INFINITY, false);
export const ValueIntegerNegativeInfinity = getScalarFromInteger(Number.NEGATIVE_INFINITY);
export const ValueNumberEpsilon = getScalarFromInteger(epsilon, false);
export const ValueNumberOneHalf = getScalarFromInteger(0.5, false);

export const ValueIntegerTop = liftScalar(Top);
export const ValueIntegerBottom = liftScalar(Bottom);