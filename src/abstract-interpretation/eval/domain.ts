import type { Const } from './domains/constant';
import type { ConstSet } from './domains/constant-set';
import type { Presuffix } from './domains/presuffix';
import type { NodeId , Node } from './graph';

export type Value = Const | ConstSet | Presuffix

export type Top = { kind: 'top' };
export const Top: Top = { kind: 'top' };

export type Bottom = { kind: 'bottom' };
export const Bottom: Bottom = { kind: 'bottom' };

export type Lift<T extends Value> = Top | Bottom | T

export function isTop<T extends Value>(value: Lift<T>): value is Top {
	return value.kind === 'top';
}

export function isBottom<T extends Value>(value: Lift<T>): value is Bottom {
	return value.kind === 'bottom';
}

export function isValue<T extends Value>(value: Lift<T>): value is T {
	return value.kind !== 'top' && value.kind !== 'bottom';
}

export type Domain<T extends Value> = {
	infer:      (node: Node, deps: ReadonlyMap<NodeId, Lift<T>>) => Lift<T>
	// widening must guarantee that the resulting value is always
	// correctly over-approximating every possible input value 
	widen:      (node: Node, deps: ReadonlyMap<NodeId, Lift<T>>) => Lift<T>
	equals:     (l: Lift<T>, r: Lift<T>) => boolean
	represents: (str: string, value: Lift<T>) => boolean
	// Returns true if and only if `l <= r`.
	// In the context of domain values, that would mean that `r` represents at
	// least every value `l` represents. Substituting `l` with `r` should
	// always be correct.
	leq:        (l: Lift<T>, r: Lift<T>) => boolean
}

export type StringDomainName = Value['kind'];
