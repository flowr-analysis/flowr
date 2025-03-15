import type { RStringValue } from '../../../../r-bridge/lang-4.x/convert-values';
import type { ValueString } from '../r-value';


export function stringFrom(str: RStringValue | string): ValueString {
	return {
		type:  'string',
		value: typeof str === 'string' ? {
			quotes: '"',
			str:    str
		} : str,
	};
}


export const ValueEmptyString = stringFrom('');