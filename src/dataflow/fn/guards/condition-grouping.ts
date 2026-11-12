/*
 * How a condition of a contract groups, without anything else of flowR, so the pages showing contracts can use it as well.
 */

/** The parts of `text` separated by `separator` outside of any parentheses, brackets, braces, or strings. */
export function splitTopLevel(this: void, text: string, separator: string): string[] {
	const parts: string[] = [];
	let depth = 0, quote: string | undefined, start = 0;
	for(let i = 0; i < text.length; i++) {
		const c = text[i];
		if(quote !== undefined) {
			quote = c === '\\' ? (i++, quote) : c === quote ? undefined : quote;
		} else if(c === '"' || c === "'" || c === '`') {
			quote = c;
		} else if('([{'.includes(c)) {
			depth++;
		} else if(')]}'.includes(c)) {
			depth--;
		} else if(depth === 0 && text.startsWith(separator, i)) {
			parts.push(text.slice(start, i));
			start = i + separator.length;
			i += separator.length - 1;
		}
	}
	return [...parts, text.slice(start)];
}

/** the connectives a condition is written with, from the one binding loosest */
const Connectives = [' and ', ' unless ', ' || ', ' && '] as const;

/** `text`, in parentheses if it has a connective outside of any other than the one it is joined by, so the two never mix */
function enclosed(this: void, text: string, within: typeof Connectives[number]): string {
	return Connectives.some(c => c !== within && splitTopLevel(text, c).length > 1) ? `(${text})` : text;
}

/**
 * The condition with its grouping made explicit, so no reader has to know how `and`, `unless`, `||`, and `&&` bind:
 * `a && b || c unless d && e` reads as `((a && b) || c) unless (d && e)`. A connective binds tighter the later it is in {@link Connectives},
 * and a case `if (w): c` keeps its condition `w` and groups what holds then.
 */
export function grouped(this: void, text: string): string {
	const [head, ...rest] = /^if \(/.test(text) ? splitTopLevel(text, ': ') : [text];
	if(rest.length > 0) {
		return `${head}: ${grouped(rest.join(': '))}`;
	}
	for(const connective of Connectives) {
		const parts = splitTopLevel(text, connective);
		if(parts.length > 1) {
			return parts.map(part => enclosed(grouped(part), connective)).join(connective);
		}
	}
	return text;
}

/** The conditions joined by `&&`, those that would mix with it in parentheses. */
export function allOf(this: void, conditions: readonly string[]): string {
	return conditions.map(c => enclosed(c, ' && ')).join(' && ');
}
