import type { Const } from './domains/constant';
import type { ConstSet } from './domains/constant-set';
import type { Presuffix } from './domains/presuffix';
import type { NodeId , type Node } from './graph';

export type Value<T extends string = string> = { kind: T }

export type Top = Value<'top'>
export const Top: Top = { kind: 'top' };

export type Bottom = Value<'bottom'>
export const Bottom: Bottom = { kind: 'bottom' };

export type Lift<T extends Value> = Top | Bottom | T

export function isTop<T extends Value>(value: Lift<T>): value is Top {
	return value.kind === 'top';
}

export function isBottom<T extends Value>(value: Lift<T>): value is Bottom {
	return value.kind === 'bottom';
}

export type Domain<T extends Value> = {
	infer:      (node: Node, deps: ReadonlyMap<NodeId, Lift<T>>) => Lift<T>
	// widening must guarantee that the resulting value is always
	// correctly over-approximating every possible input value 
	widen:      (node: Node, deps: ReadonlyMap<NodeId, Lift<T>>) => Lift<T>
	equals:     (l: Lift<T>, r: Lift<T>) => boolean
	represents: (str: string, value: Lift<T>) => boolean
}

export type StringDomainName = Const['kind'] | ConstSet['kind'] | Presuffix['kind'];
