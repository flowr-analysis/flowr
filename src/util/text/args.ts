/**
 * Just to avoid another library for splitting arguments, we use this module to provide what we need.
 * @module
 */

/** what a backslash escape in an argument stands for where it names a control character; any other escaped character stands for itself */
const ArgEscapes: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r', v: '\v', f: '\f', b: '\b' };

/** `text` with its backslash escapes undone, as an argument reads them: `a\"b` is `a"b` */
export function unescapeArg(text: string): string {
	return text.replace(/\\([^])/g, (_, c: string) => ArgEscapes[c] ?? c);
}

/** where the quote opened at `start` of `text` is closed, a backslash escaping the character after it; `undefined` if it is not */
export function closingQuote(text: string, start = 0): number | undefined {
	for(let i = start + 1; i < text.length; i++) {
		if(text[i] === '\\') {
			i++;
		} else if(text[i] === text[start]) {
			return i;
		}
	}
	return undefined;
}

/**
 * This splits an input string on the given split string (e.g., ` `), but checks if the string is quoted or escaped.
 *
 * Given an input string like `a "b c" d`, with a space character as split, and escapeQuote set to true,
 * this splits the arguments similar to common shell interpreters (i.e., `a`, `b c`, and `d`).
 *
 * When escapeQuote is set to false instead, we keep quotation marks in the result (i.e., `a`, `"b c"`, and `d`.).
 * A name in backticks is never split either, and keeps its backticks, as they belong to the name.
 * @param inputString - The string to split
 * @param escapeQuote - Keep quotes in args
 * @param split       - The character or character sequence to split on (can not be backslash or quote!)
 */
export function splitAtEscapeSensitive(inputString: string, escapeQuote = true, split: RegExp | string = ' '): string[] {
	const args = [];
	let current = '';
	let inQuotes: false | '"' | '\'' | '`' = false;
	let escaped = false;

	for(let i = 0; i < inputString.length;  i++) {
		const c = inputString[i];

		if(escaped) {
			escaped = false;
			current += ArgEscapes[c] ?? c;
		} else if(!inQuotes
				&& current !== ''
				&& (split instanceof RegExp ? split.test(inputString.slice(i)) : inputString.slice(i, i + split.length) === split)
		) {
			args.push(current);
			current = '';
		} else if(c === '`' && (!inQuotes || inQuotes === c)) {
			/* a name in backticks may hold a space, and the backticks are part of the name, so they are always kept */
			inQuotes = inQuotes ? false : c;
			current += c;
		} else if((c === '"' || c === "'") && inQuotes !== '`') {
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


const MatchingClose = {
	'<': '>',
	'[': ']',
	'(': ')',
	'"': '"',
	"'": "'"
} as const;

/**
 * Splits the given string on 'and', but only if not nested inside `<>`, `[]`, `()`, or quotes.
 * This also handles escaped quotes.
 * @param str     - The string to split
 * @param splitOn - The string to split on (default: 'and')
 * @param closes  - The matching of closing characters for nesting, structures with different open and close characters only can be nested
 *                 of each other, while those with the same open and close character (like quotes) can not be nested inside themselves.
 */
export function splitOnNestingSensitive(
	str: string,
	splitOn: string = 'and',
	closes: Record<string, string> = MatchingClose,
): string[] {
	const result: string[] = [];
	const openCloseSame = new Set(Object.entries(closes).filter(([open, close]) => open === close).map(([open]) => open));
	let current = '';
	const nestStack: (keyof typeof closes)[] = [];
	for(let i = 0; i < str.length; i++) {
		const c = str[i];
		if(c === '\\' && i + 1 < str.length) {
			// skip escaped characters
			current += c + str[i + 1];
			i++;
		} else if(nestStack.length > 0) {
			if(!openCloseSame.has(c) && c in closes) {
				// opening a new nest
				nestStack.push(c);
			} else {
				const top = nestStack[nestStack.length - 1];
				if(c === closes[top]) {
					nestStack.pop();
				}
			}
			current += c;
		} else {
			if(c in closes) {
				nestStack.push(c);
				current += c;
				continue;
			}
			// check for 'and' split
			if(str.slice(i, i + splitOn.length) === splitOn &&
				(i === 0 || /\s/.test(str[i - 1])) &&
				(i + splitOn.length >= str.length || /\s/.test(str[i + splitOn.length]))) {
				// split here
				result.push(current.trim());
				current = '';
				i += splitOn.length - 1;
				continue;
			}
			current += c;
		}
	}
	if(current.trim().length > 0) {
		result.push(current.trim());
	}
	return result;
}