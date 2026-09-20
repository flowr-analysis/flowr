import type { Lift, ValueNumber } from '../r-value';
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
