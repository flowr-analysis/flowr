import type { ValueLogical } from '../r-value';

export const LogicalTrue: ValueLogical = {
	type:  'logical',
	value: true
};
export const LogicalFalse: ValueLogical = {
	type:  'logical',
	value: false
};
export const LogicalMaybe: ValueLogical = {
	type:  'logical',
	value: 'maybe'
};