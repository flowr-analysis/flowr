import type { RStringValue } from '../../../../r-bridge/lang-4.x/convert-values';
import { bottomTopGuard } from '../general';
import { type Lift, type Value, type ValueString, Bottom, isValue, Top } from '../r-value';

/**
 * Lift a raw string or R string value into a ValueString.
 * @see {@link liftString} - for lifting a Lift<RStringValue>
 */
export function stringFrom(str: RStringValue | string): ValueString {
	return {
		type:  'string',
		value: typeof str === 'string' ? {
			quotes: '"',
			str:    str
		} : str,
	};
}

/**
 * Lift a Lift<RStringValue> into a ValueString.
 * @see {@link stringFrom} - for lifting a raw string or R string value.
 */
export function liftString(str: Lift<RStringValue>): ValueString {
	return {
		type:  'string',
		value: str
	};
}

/**
 * Collect strings from an array of ValueString.
 * If any value is not a string, or is Bottom/Top, undefined is returned.
 * @param a           - The array of Value to collect strings from.
 * @param withQuotes  - Whether to include the quotes in the returned strings.
 * @returns           - An array of strings, or undefined if any value is not a string.
 */
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
			values.push(`${value.value.quotes}${value.value.str}${value.value.quotes}` );
		} else {
			values.push(value.value.str);
		}
	}

	return values;
}

export const ValueEmptyString = stringFrom('');
export const ValueStringTop = liftString(Top);
export const ValueStringBot = liftString(Bottom);