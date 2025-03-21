import type { RStringValue } from '../../../../r-bridge/lang-4.x/convert-values';
import type { Lift, ValueString } from '../r-value';
import { Bottom, Top } from '../r-value';


export function stringFrom(str: RStringValue | string): ValueString {
	return {
		type:  'string',
		value: typeof str === 'string' ? {
			quotes: '"',
			str:    str
		} : str,
	};
}

export function liftString(str: Lift<RStringValue>): ValueString {
	return {
		type:  'string',
		value: str
	};
}


export const ValueEmptyString = stringFrom('');
export const ValueStringTop = liftString(Top);
export const ValueStringBot = liftString(Bottom);