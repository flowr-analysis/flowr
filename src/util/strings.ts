/**
 * Check if the given string starts and ends with the given letter
 */
export function startAndEndsWith(str: string, letter: string): boolean {
	return str.startsWith(letter) && str.endsWith(letter)
}
