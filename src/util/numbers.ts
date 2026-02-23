/**
 * Converts a bigint (or string representation of a bigint) to a number by removing the trailing `n`.
 * Please note that this can lead to loss of precision for very large bigints.
 */
export function bigint2number(a: bigint | string): number {
	// we have to remove the trailing `n`
	return Number(String(a).slice(0, -1));
}

/**
 * Rounds a number to the specified number of decimal places.
 */
export function roundToDecimals(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

/**
 * Returns the minimum and maximum value from an array of numbers.
 * @param values - The array of numbers to get the minimum and maximum from.
 */
export function getMinMax(values: number[]): { min: number, max: number } | undefined {
	if(values.length === 0) {
		return undefined;
	}
	let min = values[0];
	let max = values[0];
	for(const value of values.slice(1)) {
		if(value < min) {
			min = value;
		} else if(value > max) {
			max = value;
		}
	}
	return { min, max };
}