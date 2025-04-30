import type { Lift, Value, ValueVector } from '../r-value';
import { isBottom, isTop , Top } from '../r-value';
import { guard } from '../../../../util/assert';


export function vectorFrom<V extends Lift<Value[]>>(elements: V): ValueVector<V> {
	guard(isTop(elements) || isBottom(elements) || Array.isArray(elements), 'Expected array of values');
	return {
		type:          'vector',
		elements,
		elementDomain: Top
	};
}
