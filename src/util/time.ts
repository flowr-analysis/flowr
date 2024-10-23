/**
 * Retrieve a string in the form of "YYYY-MM-DD-HH-MM-SS-MS" from a Date object.
 *
 * @param date - The date to convert, defaults to the current date
 */
export function date2string(date: Date = new Date()): string {
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}-${date.getMilliseconds()}`;
}

/**
 * Print a number of milliseconds in a human-readable format including correct spacing.
 */
export function printAsMs(ms: number, precision = 2): string {
	/* eslint-disable-next-line no-irregular-whitespace*/
	return `${ms.toFixed(precision)} ms`;
}
