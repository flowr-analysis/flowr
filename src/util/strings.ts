/**
 * Check if the given string starts and ends with the given letter
 */
export function startAndEndsWith(str: string, letter: string): boolean {
	return str.startsWith(letter) && str.endsWith(letter)
}

/**
 * Removes all whitespace in the given string
 */
export function withoutWhitespace(output: string): string {
	return output.replace(/\s/g,'')
}
