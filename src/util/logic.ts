// diverging from boolean | maybe requires explicit handling
import { isUndefined } from './assert';

export enum Ternary {
	Always = 'always',
	Maybe = 'maybe',
	Never = 'never'
}

export const SignificancePrecisionComparison = {
	/**
	 * Compares two numbers for equality with a precision based on the number of significant figures of the interval domain.
	 * If the number of significant figures is not finite, an exact comparison is performed.
	 * @param a - The first number to compare.
	 * @param b - The second number to compare.
	 * @param significantFigures - The number of significant figures to consider for the comparison (undefined means exact comparison).
	 * @returns A ternary value indicating whether the two numbers are considered equal (Ternary.Always), not equal (Ternary.Never),
	 *          or maybe equal (Ternary.Maybe) based on the significance precision.
	 * @private
	 */
	isEqualWithSignificancePrecision(this: void, a: number, b: number, significantFigures: number | undefined): Ternary {
		if(isUndefined(significantFigures)) {
			// If significantFigures is not finite, we consider the values to be exactly equal or not equal
			return a === b ? Ternary.Always : Ternary.Never;
		}

		if(Number.isFinite(a) && Number.isFinite(b) && a !== b) {
			const sigFactor = 0.5 * Math.pow(10, 1 - significantFigures);

			const absA = Math.abs(a);
			const absB = Math.abs(b);
			const max = absA > absB ? absA : absB;

			return Math.abs(absA - absB) <= sigFactor * max ? Ternary.Maybe : Ternary.Never;
		}
		return a === b ? Ternary.Always : Ternary.Never;
	},

	/**
	 * Compares two numbers for less-than relation with a precision based on the number of significant figures of the interval domain.
	 * If the number of significant figures is not finite, an exact comparison is performed.
	 * @param a - The first number to compare.
	 * @param b - The second number to compare.
	 * @param significantFigures - The number of significant figures to consider for the comparison (undefined means exact comparison).
	 * @returns A ternary value indicating whether the first number is considered less than the second number (Ternary.Always),
	 *          not less than (Ternary.Never), or maybe less than (Ternary.Maybe) based on the significance precision.
	 * @private
	 */
	isLowerWithSignificancePrecision(this: void, a: number, b: number, significantFigures: number | undefined): Ternary {
		if(isUndefined(significantFigures)) {
			return a < b ? Ternary.Always : Ternary.Never;
		}

		let less = a < b ? Ternary.Always : Ternary.Never;
		if(less === Ternary.Never) {
			// a is not less than b, so we check for equality with significance precision
			if(SignificancePrecisionComparison.isEqualWithSignificancePrecision(a, b, significantFigures) !== Ternary.Never) {
				less = Ternary.Maybe;
			}
		}
		return less;
	},

	/**
	 * Compares two numbers for less-than-or-equal relation with a precision based on the number of significant figures of the interval domain.
	 * If the number of significant figures is not finite, an exact comparison is performed.
	 * @param a - The first number to compare.
	 * @param b - The second number to compare.
	 * @param significantFigures - The number of significant figures to consider for the comparison (undefined means exact comparison).
	 * @returns A ternary value indicating whether the first number is considered less than or equal to the second number (Ternary.Always),
	 *          not less than or equal to (Ternary.Never), or maybe less than or equal to (Ternary.Maybe) based on the significance precision.
	 * @private
	 */
	isLowerEqualWithSignificancePrecision(this: void, a: number, b: number, significantFigures: number | undefined): Ternary {
		let leq = a <= b ? Ternary.Always : Ternary.Never;
		if(leq === Ternary.Never) {
			// a is not less than b, so we check for equality with significance precision
			leq = SignificancePrecisionComparison.isEqualWithSignificancePrecision(a, b, significantFigures);
		}
		return leq;
	}
};