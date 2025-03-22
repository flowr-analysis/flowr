import type { Lift, Value, ValueSet } from '../r-value';
import { Top } from '../r-value';
import { bottomTopGuard } from '../general';

function flattenSetElements(s: Lift<Value[]>): Lift<Value[]> {
	return bottomTopGuard(s) ?? (s as Value[]).flatMap(e => {
		return e.type === 'set' ? flattenSetElements(e.elements) : e;
	});
}

export function setFrom<V extends Value[]>(...elements: V): ValueSet {
	return {
		type:     'set',
		elements: elements.flatMap(e => {
			return e.type === 'set' ? flattenSetElements(e.elements) : e;
		})
	};
}

// TODO: flatten, union intervals etc.

export const ValueEmptySet = setFrom();
export const ValueSetTop: ValueSet<typeof Top> = {
	type:     'set',
	elements: Top
};
export const ValueSetBottom: ValueSet<typeof Top> = {
	type:     'set',
	elements: Top
};
