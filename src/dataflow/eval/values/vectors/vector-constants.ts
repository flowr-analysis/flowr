import type { Value, ValueVector } from '../r-value';
import { Bottom , Top } from '../r-value';


export function vectorFrom<V extends Value[]>(...elements: V): ValueVector<V> {
	return {
		type: 'vector',
		elements
	};
}

export const ValueEmptyVector = vectorFrom();
export const ValueVectorTop: ValueVector<typeof Top> = {
	type:     'vector',
	elements: Top
};
export const ValueVectorBottom: ValueVector<typeof Bottom> = {
	type:     'vector',
	elements: Bottom
};