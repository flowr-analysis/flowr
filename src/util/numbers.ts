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