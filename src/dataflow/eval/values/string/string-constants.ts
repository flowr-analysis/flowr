import type { RStringValue } from '../../../../r-bridge/lang-4.x/convert-values';
import { bottomTopGuard } from '../general';
import { type Lift, type Value, type ValueString, Bottom, isValue, Top } from '../r-value';

/** lift a raw string or R string value into a ValueString; see {@link liftString} for lifting a Lift<RStringValue> */
export function stringFrom(str: RStringValue | string): ValueString {
	return { type: 'string', value: typeof str === 'string' ? { quotes: '"', str } : str };
}

/** the escapes standing for exactly one character, everything else R writes as a numeric code */
const SimpleEscapes: Readonly<Record<string, string>> = {
	n:    '\n',
	r:    '\r',
	t:    '\t',
	b:    '\b',
	a:    '\x07',
	f:    '\f',
	v:    '\v',
	'\\': '\\',
	'"':  '"',
	'\'': '\'',
	'`':  '`'
};

/** the largest code point there is, so an `\U` escape naming none of them is rejected instead of throwing */
const MaxCodePoint = 0x10FFFF;

/** `\xnn`, `\u{nnnn}`, `\unnnn`, `\U{nnnnnnnn}`, `\Unnnnnnnn`, an octal `\nnn`, or a single-character escape */
const EscapePattern = /\\(?:x([0-9a-fA-F]{1,2})|u\{([0-9a-fA-F]{1,6})\}|u([0-9a-fA-F]{1,4})|U\{([0-9a-fA-F]{1,8})\}|U([0-9a-fA-F]{1,8})|([0-7]{1,3})|([\s\S]))/g;

/** the characters an R string literal stands for (`"a\tb"` is three characters, not the four its source is written with); undefined for an escape R would reject */
export
function unescapeRString(this: void, str: string): string | undefined {
	if(!str.includes('\\')) {
		return str;
	}
	let rejected = false;
	const out = str.replace(EscapePattern, (_all, hex?: string, uBraced?: string, u?: string, bigBraced?: string, big?: string, octal?: string, single?: string) => {
		const code = hex ?? uBraced ?? u ?? bigBraced ?? big;
		if(code !== undefined || octal !== undefined) {
			const point = code !== undefined ? parseInt(code, 16) : parseInt(octal as string, 8);
			rejected ||= point > MaxCodePoint;
			return point > MaxCodePoint ? '' : String.fromCodePoint(point);
		}
		const simple = single === undefined ? undefined : SimpleEscapes[single];
		rejected ||= simple === undefined;
		return simple ?? '';
	});
	return rejected ? undefined : out;
}

/** the {@link ValueString} an R string literal stands for, escapes resolved (a raw string has none, so it stands for its characters as written); undefined for an escape R would reject */
export
function stringFromLiteral(this: void, value: RStringValue): ValueString | undefined {
	if(value.flag === 'raw') {
		return stringFrom(value);
	}
	const str = unescapeRString(value.str);
	return str === undefined ? undefined : stringFrom({ ...value, str });
}

/** lift a Lift<RStringValue> into a ValueString; see {@link stringFrom} for lifting a raw string or R string value */
export function liftString(str: Lift<RStringValue>): ValueString {
	return { type: 'string', value: str };
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

/** utility functions for the strings a program writes down, as opposed to the ones it computes */
export const ValueEmptyString = stringFrom('');
export const ValueStringTop = liftString(Top);
export const ValueStringBot = liftString(Bottom);