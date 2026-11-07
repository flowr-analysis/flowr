import { type Value, type ValueList, type ValueListElement, type ValueNull, isValue } from '../r-value';

/** The `NULL` that a missing element of a list reads as. */
export const ValueNullConstant: ValueNull = { type: 'null' };

/**
 * A list of the given elements, in their order.
 * @example
 * ```ts
 * listFrom([{ name: 'a', value: intervalFrom(1, 1) }]) // list(a = 1)
 * ```
 */
export function listFrom(elements: readonly ValueListElement[]): ValueList {
	return { type: 'list', elements };
}

/** What the elements of an empty list or `NULL` turn into once a replacement adds an element. */
function elementsOf(container: Value): readonly ValueListElement[] | undefined {
	if(!isValue(container)) {
		return undefined;
	}
	return container.type === 'list' ? container.elements : container.type === 'null' ? [] : undefined;
}

/**
 * The element of the list `name` names, as `l$name` (`exact = false`) and `l[["name"]]` read it: an exact match first,
 * for `$` else the one element whose name starts with `name`, and `NULL` if there is none.
 * @example
 * ```ts
 * listField(listFrom([{ name: 'abc', value: one }]), 'a', false) // one, as `list(abc = 1)$a` is 1
 * ```
 */
export function listField(list: ValueList, name: string, exact: boolean): Value {
	const match = list.elements.find(e => e.name === name);
	if(match !== undefined || exact) {
		return match?.value ?? ValueNullConstant;
	}
	const partial = list.elements.filter(e => e.name?.startsWith(name));
	return partial.length === 1 ? partial[0].value : ValueNullConstant;
}

/** The `k`-th element of the list as `l[[k]]` reads it, `undefined` where R stops with an error. */
export function listElementAt(list: ValueList, k: number): Value | undefined {
	return list.elements[Math.trunc(k) - 1]?.value;
}

/** Whether the value may be `NULL`, which removes the element it is assigned to instead of holding it. */
function mayBeNull(value: Value): boolean {
	return !isValue(value) || value.type === 'null' || (value.type === 'set' && (!isValue(value.elements) || value.elements.some(mayBeNull)));
}

/**
 * The list after `l$name <- value` or `l[[key]] <- value`, with `key` a name or a position: assigning matches names
 * exactly, `NULL` removes the element, a position past the end pads with `NULL`. `undefined` if the container is no
 * list (nor `NULL`, which turns into one) or the value may be `NULL` without surely being so.
 * @example
 * ```ts
 * withListElement(listFrom([{ name: 'a', value: one }]), 'a', five) // list(a = 5)
 * ```
 */
export function withListElement(container: Value, key: string | number, value: Value): ValueList | undefined {
	const elements = elementsOf(container);
	if(elements === undefined) {
		return undefined;
	}
	const remove = isValue(value) && value.type === 'null';
	if(!remove && mayBeNull(value)) {
		return undefined;
	}
	const at = typeof key === 'string' ? elements.findIndex(e => e.name === key) : Math.trunc(key) - 1;
	if(at < 0 && typeof key === 'number') {
		return undefined;
	}
	if(remove) {
		return listFrom(at < 0 || at >= elements.length ? elements : elements.toSpliced(at, 1));
	} else if(at < 0) {
		return listFrom([...elements, { name: key as string, value }]);
	} else if(at < elements.length) {
		return listFrom(elements.with(at, { name: elements[at].name, value }));
	}
	const padding = Array.from({ length: at - elements.length }, () => ({ name: undefined, value: ValueNullConstant }));
	return listFrom([...elements, ...padding, { name: undefined, value }]);
}
