import type { Value, ValueVector } from '../r-value';

export function unionVector<V extends Value[]>(...vs: ValueVector<V>[]): ValueVector<V> {
	return {
		type:     'vector',
		elements: vs.flatMap(s => s.elements) as V
	};
}