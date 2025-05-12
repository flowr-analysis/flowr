import type { Lift, Value, ValueVector } from '../r-value';
import { isBottom, isTop , isValue, Top } from '../r-value';
import { guard } from '../../../../util/assert';
import { bottomTopGuard } from '../general';

export function vectorFrom<V extends Lift<Value[]>>(elements: V): ValueVector<V> {
	guard(isTop(elements) || isBottom(elements) || Array.isArray(elements), 'Expected array of values');
	return {
		type:          'vector',
		elements,
		elementDomain: Top
	};
}

export function flattenVectorElements(s: Lift<Value[]>): Lift<Value[]> {
	return bottomTopGuard(s) ?? (s as Value[]).flatMap(e => {
		return e.type === 'vector' ? flattenVectorElements(e.elements):
			e.type === 'set' && isValue(e.elements) && e.elements.length === 1 ?
				e.elements[0].type === 'vector' ? flattenVectorElements(e.elements[0].elements) : e.elements :
				e;
	});
}

