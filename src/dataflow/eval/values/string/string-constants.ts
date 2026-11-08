import type { RStringValue } from '../../../../r-bridge/lang-4.x/convert-values';
import { bottomTopGuard } from '../general';
import { type Value, type ValueString, isValue } from '../r-value';

/** lift a raw string or R string value into a ValueString */
export function stringFrom(str: RStringValue | string): ValueString {
	return { type: 'string', value: typeof str === 'string' ? { quotes: '"', str } : str };
}

/** the escapes of an R string that stand for one character each */
const SimpleEscapes: Readonly<Record<string, string>> = {
	a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', '"': '"', '\'': '\'', '`': '`', ' ': ' ', '\n': '\n'
};
/** the escapes of an R string that state a code: octal, hex, and the unicode forms with and without braces */
const CodedEscape = /^(?:([0-7]{1,3})|x([0-9a-fA-F]{1,2})|u\{([0-9a-fA-F]{1,4})\}|u([0-9a-fA-F]{1,4})|U\{([0-9a-fA-F]{1,8})\}|U([0-9a-fA-F]{1,8}))/;

/**
 * The characters R stores for the content of a string literal, with its escapes undone as R's parser undoes them:
 * `a\tb` is three characters. It is `undefined` where R rejects the literal (an unknown escape such as `\.`, a nul)
 * or stores a byte no character stands for (`\xff`).
 */
export
function unescapeRString(this: void, str: string): string | undefined {
	let out = '';
	for(let i = 0; i < str.length; i++) {
		if(str[i] !== '\\') {
			out += str[i];
			continue;
		}
		const simple = SimpleEscapes[str[++i]];
		if(simple !== undefined) {
			out += simple;
			continue;
		}
		const coded = CodedEscape.exec(str.slice(i));
		if(coded === null) {
			return undefined;
		}
		const [whole, octal, hex, ...unicode] = coded;
		const code = parseInt(octal ?? hex ?? unicode.find(u => u !== undefined) ?? '', octal === undefined ? 16 : 8);
		if(code === 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF) || ((octal ?? hex) !== undefined && code > 0x7F)) {
			return undefined;
		}
		out += String.fromCodePoint(code);
		i += whole.length - 1;
	}
	return out;
}

/** the characters a string literal stands for, see {@link unescapeRString}: a raw string stands for its characters as written */
export function contentOf(this: void, { str, flag }: RStringValue): string | undefined {
	return flag === 'raw' ? str : unescapeRString(str);
}

/** the {@link ValueString} an R string literal stands for, escapes resolved (a raw string has none, so it stands for its characters as written); undefined for an escape R would reject */
export
function stringFromLiteral(this: void, value: RStringValue): ValueString | undefined {
	const str = contentOf(value);
	return str === undefined ? undefined : stringFrom({ ...value, str });
}

/** collect strings from an array of ValueString, with quotes if `withQuotes`; undefined if any value is not a string, or is Bottom/Top */
export function collectStrings(a: Value[], withQuotes: boolean = false): string[] | undefined {
	if(bottomTopGuard(a)) {
		return undefined;
	}

	const values: string[] = [];
	for(const value of a) {
		if(value.type !== 'string' || !isValue(value) || !isValue(value.value)) {
			return undefined;
		}

		if(withQuotes) {
			values.push(`${value.value.quotes}${value.value.str}${value.value.quotes}`);
		} else {
			values.push(value.value.str);
		}
	}

	return values;
}
