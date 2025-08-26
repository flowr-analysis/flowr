import type { Const } from './domains/constant';
import type { ConstSet } from './domains/constant-set';

export type Top = { kind: 'top' }
export const Top: Top = { kind: 'top' };

export type Bottom = { kind: 'bottom' }
export const Bottom: Bottom = { kind: 'bottom' };

export type SDValue = Top | Bottom | Const | ConstSet

// TODO: Rename: Abstract Operations String Domain
export interface StringDomain {
	const(value: string): SDValue,
	concat: (sep: SDValue, ...args: readonly SDValue[]) => SDValue,
	join:   (...args: readonly SDValue[]) => SDValue,
}

export function isTop(value: SDValue): value is Top {
	return value.kind === 'top';
}

export function isBottom(value: SDValue): value is Bottom {
	return value.kind === 'bottom';
}
