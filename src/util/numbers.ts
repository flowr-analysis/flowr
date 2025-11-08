/**
 *
 */
export function bigint2number(a: bigint | string): number {
	// we have to remove the trailing `n`
	return Number(String(a).slice(0, -1));
}

/**
 *
 */
export function roundToDecimals(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}