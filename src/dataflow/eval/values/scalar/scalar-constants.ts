import type { ValueNumber } from '../r-value';

export function getScalarInteger(value: number): ValueNumber {
	return {
		type:  'number',
		value: {
			markedAsInt:   true,
			num:           value,
			complexNumber: false
		}
	};
}

export const ValueIntegerOne: ValueNumber = getScalarInteger(1);
export const ValueIntegerZero: ValueNumber = getScalarInteger(0);
export const ValueIntegerNegativeOne: ValueNumber = getScalarInteger(-1);
