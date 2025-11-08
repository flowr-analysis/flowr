import type { RStringValue } from '../../../../r-bridge/lang-4.x/convert-values';
import { bottomTopGuard } from '../general';
import { type Lift, type Value, type ValueString , Bottom, isValue, Top } from '../r-value';


/**
 *
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
 *
 */
export function liftString(str: Lift<RStringValue>): ValueString {
	return {
		type:  'string',
		value: str
	};
}

/**
 *
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