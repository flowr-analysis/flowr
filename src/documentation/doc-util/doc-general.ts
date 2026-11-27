
/**
 * Prefixes each line in the given string with the given prefix.
 * @example
 * ```ts
 * const text = `Line 1
 * Line 2
 * Line 3`;
 * const prefixed = prefixLines(text, '> ');
 * console.log(prefixed);
 * ```
 * This will output:
 * ```md
 * > Line 1
 * > Line 2
 * > Line 3
 * ```
 */
export function prefixLines(line: string, prefix: string) {
	return line.split('\n').map(l => `${prefix}${l}`).join('\n');
}
