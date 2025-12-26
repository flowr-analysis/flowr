/**
 * Just to avoid another library for splitting arguments, we use this module to provide what we need.
 * @module
 */

/**
 * This splits an input string on the given split string (e.g., ` `), but checks if the string is quoted or escaped.
 *
 * Given an input string like `a "b c" d`, with a space character as split, and escapeQuote set to true,
 * this splits the arguments similar to common shell interpreters (i.e., `a`, `b c`, and `d`).
 *
 * When escapeQuote is set to false instead, we keep quotation marks in the result (i.e., `a`, `"b c"`, and `d`.).
 * @param inputString - The string to split
 * @param escapeQuote - Keep quotes in args
 * @param split       - The character or character sequence to split on (can not be backslash or quote!)
 */
export function splitAtEscapeSensitive(inputString: string, escapeQuote = true, split: RegExp | string = ' '): string[] {
	const args = [];
	let current = '';
	let inQuotes: false | '"' | '\'' = false;
	let escaped = false;

	for(let i = 0; i < inputString.length;  i++) {
		const c = inputString[i];
		const sub = inputString.slice(i);

		if(escaped) {
			escaped = false;
			switch(c) {
				case 'n': current += '\n'; break;
				case 't': current += '\t'; break;
				case 'r': current += '\r'; break;
				case 'v': current += '\v'; break;
				case 'f': current += '\f'; break;
				case 'b': current += '\b'; break;
				default: current += c;
			}
		} else if(!inQuotes
				&& current !== ''
				&& (split instanceof RegExp ? split.test(sub) : inputString.slice(i, i + split.length) === split)
		) {
			args.push(current);
			current = '';
		} else if(c === '"' || c === "'") {
			if(!inQuotes) {
				inQuotes = c;
				if(escapeQuote) {
					continue;
				}
			} else if(inQuotes === c) {
				inQuotes = false;
				if(escapeQuote) {
					continue;
				}
			}
			current += c;
		} else if(c === '\\' && escapeQuote) {
			escaped = true;
		} else {
			current += c;
		}
	}

	if(current !== '') {
		args.push(current);
	}

	return args;
}
