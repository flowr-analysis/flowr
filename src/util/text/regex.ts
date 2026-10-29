/**
 * Regular expressions written by a user, which may not compile. Free of node modules, as the browser pages use it.
 * @module
 */

/** `source` as a regular expression, or the error saying why it is none */
export function tryRegex(source: string, flags?: string): RegExp | SyntaxError {
	try {
		return new RegExp(source, flags);
	} catch(error) {
		return error as SyntaxError;
	}
}

/** `source` as a regular expression, `undefined` where it does not compile */
export function compileRegex(source: string, flags?: string): RegExp | undefined {
	const regex = tryRegex(source, flags);
	return regex instanceof RegExp ? regex : undefined;
}

/** the regular expression `text` writes between slashes, like `/^read/`, `undefined` for any other text or one that does not compile */
export function slashedRegex(text: string, flags?: string): RegExp | undefined {
	const slashed = /^\/(.+)\/$/.exec(text.trim());
	return slashed === null ? undefined : compileRegex(slashed[1], flags);
}
