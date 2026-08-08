import { bottomTopGuard } from '../general';
import { type Lift, type Value, type ValueSet, Top } from '../r-value';

function flattenSetElements(s: Lift<Value[]>): Lift<Value[]> {
	return bottomTopGuard(s) ?? (s as Value[]).flatMap(e => {
		return e.type === 'set' ? flattenSetElements(e.elements) : e;
	});
}

/**
 * Creates a value set from the given elements.
 * @see {@link isSet} - to check whether a value is a set
 */
export function setFrom<V extends Value[]>(...elements: V): Lift<ValueSet<Value[]>> {
	const vals = elements.flatMap(e => {
		return e.type === 'set' ? flattenSetElements(e.elements) : e;
	});

	return bottomTopGuard(...vals) ?? {
		type:     'set',
		elements: vals
	};
}


/**
 * Checks, whether the given value is a set.
 * @see {@link setFrom} - to create sets
 */
export function isSet<V extends Value>(element: V): boolean {
	return element.type === 'set';
}

export const ValueEmptySet = setFrom();
export const ValueSetTop: ValueSet<typeof Top> = {
	type:     'set',
	elements: Top
};
export const ValueSetBottom: ValueSet<typeof Top> = {
	type:     'set',
	elements: Top
};