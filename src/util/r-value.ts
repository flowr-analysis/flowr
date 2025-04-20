import type { RLogicalValue } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { RFalse, RTrue, type RNumberValue, type RStringValue } from '../r-bridge/lang-4.x/convert-values';

function isRValue(value: unknown): value is RStringValue | RNumberValue | RLogicalValue | string | number {
	return isRStringValue(value) || isRNumberValue(value) || isRLogicalValue(value) || typeof value === 'string' || typeof value === 'number';
}

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
export function unwrapRValue(value: RStringValue | RNumberValue | RLogicalValue | string | number): string | number | boolean;
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

export function unwrapRVector(value: RStringValue[] | string[]): string[];
export function unwrapRVector(value: RNumberValue[] | number[]): number[];
export function unwrapRVector(value: RLogicalValue[]): boolean[];
export function unwrapRVector(value: RStringValue[] | RNumberValue[] | RLogicalValue[] | string[] | number[]): string[] | number[] | boolean[];
export function unwrapRVector(value: unknown): string[] | number[] | boolean[] | (string | number | boolean)[] | undefined;
export function unwrapRVector(value: RStringValue[] | RNumberValue[] | RLogicalValue[] | string[] | number[] | unknown): string[] | number[] | boolean[] | (string | number | boolean)[] | undefined {
	if(!Array.isArray(value)) {
		return undefined;
	} else if(value.every(entry => typeof entry === 'string') || value.every(entry => typeof entry === 'number') || value.every(entry => typeof entry === 'boolean')) {
		return value;
	} else if(value.every(isRStringValue)) {
		return value.map(entry => unwrapRValue(entry));
	} else if(value.every(isRNumberValue)) {
		return value.map(entry => unwrapRValue(entry));
	} else if(value.every(isRValue)) {
		return value.map(entry => unwrapRValue(entry));
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
