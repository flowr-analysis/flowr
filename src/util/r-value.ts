import type { RLogicalValue } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { RFalse, RTrue, type RNumberValue, type RStringValue } from '../r-bridge/lang-4.x/convert-values';

export function isRStringValue(value: unknown): value is RStringValue {
	return typeof value === 'object' && value !== null && 'str' in value && typeof value.str === 'string';
}

export function isRNumberValue(value: unknown): value is RNumberValue {
	return typeof value === 'object' && value !== null && 'num' in value && typeof value.num === 'number';
}

export function isRLogicalValue(value: unknown): value is RLogicalValue {
	return typeof value === 'boolean';
}

export function unwrapRValue(value: RStringValue | string): string;
export function unwrapRValue(value: RNumberValue | number): number;
export function unwrapRValue(value: RLogicalValue): boolean;
export function unwrapRValue(value: unknown): string | number | boolean | undefined;
export function unwrapRValue(value: RStringValue | RNumberValue | RLogicalValue | string | number | unknown): string | number | boolean | undefined {
	if(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return value;
	} else if(isRStringValue(value)) {
		return value.str;
	} else if(isRNumberValue(value)) {
		return value.num;
	} else {
		return undefined;
	}
}

export function unwrapRValueToString(value: RStringValue | RNumberValue | RLogicalValue | string | number): string;
export function unwrapRValueToString(value: unknown): string | undefined;
export function unwrapRValueToString(value: RStringValue | RNumberValue | RLogicalValue | string | number | unknown): string | undefined {
	if(typeof value === 'string') {
		return value;
	} else if(typeof value === 'number') {
		return value.toString();
	} else if(typeof value === 'boolean') {
		return value ? RTrue : RFalse;
	} else if(isRStringValue(value)) {
		return value.str;
	} else if(isRNumberValue(value)) {
		return value.num.toString();
	} else {
		return undefined;
	}
}
