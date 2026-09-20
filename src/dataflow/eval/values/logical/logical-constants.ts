import type { ValueLogical } from '../r-value';

function makeLogical(log: boolean): ValueLogical {
	return {
		type:  'logical',
		value: log
	};
}

export const ValueLogicalTrue: ValueLogical = makeLogical(true);
export const ValueLogicalFalse: ValueLogical = makeLogical(false);
