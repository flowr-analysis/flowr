import type { Const } from './domains/constant';
import type { ConstSet } from './domains/constant-set';

export type Top = { kind: 'top' }
export const Top: Top = { kind: 'top' };

export type Bottom = { kind: 'bottom' }
export const Bottom: Bottom = { kind: 'bottom' };

export type SDValue = Top | Bottom | Const | ConstSet

export type StringDomainName = Const["kind"] | ConstSet["kind"];

export interface AbstractOperationsStringDomain {
	const(value: string): SDValue,
	concat: (sep: SDValue, ...args: readonly SDValue[]) => SDValue,
	join:   (...args: readonly SDValue[]) => SDValue,
	map: (value: SDValue, func: (str: string) => string) => SDValue,
	sprintf: (fmt: SDValue, ...args: readonly SDValue[]) => SDValue,
}

export function isTop(value: SDValue): value is Top {
	return value.kind === 'top';
}

export function isBottom(value: SDValue): value is Bottom {
	return value.kind === 'bottom';
}

export function isElement(value: string, domainValue: SDValue): boolean {
	switch (domainValue.kind) {
		case 'top':
			return true;
		case 'bottom':
			return false;
		case 'const':
			return domainValue.value === value;
		case 'const-set':
			return domainValue.value.some(it => it == value);
	}
}
