import type { ValueLogical } from '../r-value';

export const ValueLogicalTrue: ValueLogical = {
	type:  'logical',
	value: true
};
export const ValueLogicalFalse: ValueLogical = {
	type:  'logical',
	value: false
};
export const ValueLogicalMaybe: ValueLogical = {
	type:  'logical',
	value: 'maybe'
};