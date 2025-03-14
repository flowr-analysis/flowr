import type { ValueNumber } from '../r-value';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';

export function getScalarFromInteger(value: number): ValueNumber {
	return {
		type:  'number',
		value: {
			markedAsInt:   true,
			num:           value,
			complexNumber: false
		}
	};
}

export function liftScalar(value: RNumberValue): ValueNumber {
	return {
		type:  'number',
		value: value
	};
}

export const ValueIntegerOne: ValueNumber = getScalarFromInteger(1);
export const ValueIntegerZero: ValueNumber = getScalarFromInteger(0);
export const ValueIntegerNegativeOne: ValueNumber = getScalarFromInteger(-1);
