
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


/**
 * Joins the given elements using the given join string, but uses a different string for the last join.
 * @example
 * ```ts
 * const items = ['apple', 'banana', 'cherry'];
 * const result = lastJoin(items, ', ', ' and ');
 * console.log(result); // Output: "apple, banana and cherry"
 * ```
 */
export function lastJoin(elements: readonly string[], join: string, lastjoin: string) {
	if(elements.length <= 1) {
		return elements.join(lastjoin);
	} else {
		return elements.slice(0, -1).join(join) + lastjoin + elements[elements.length - 1];
	}
}
