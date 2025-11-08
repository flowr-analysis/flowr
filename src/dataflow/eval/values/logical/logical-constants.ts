import { type Lift, type TernaryLogical, type ValueLogical , Bottom, Top } from '../r-value';

/**
 *
 */
export function liftLogical(log: Lift<TernaryLogical>): ValueLogical {
	if(log === Top) {
		return ValueLogicalTop;
	} else if(log === Bottom) {
		return ValueLogicalBot;
	} else if(log === 'maybe') {
		return ValueLogicalMaybe;
	} else {
		return log ? ValueLogicalTrue : ValueLogicalFalse;
	}
}

function makeLogical(log: Lift<TernaryLogical>): ValueLogical {
	return {
		type:  'logical',
		value: log
	};
}

export const ValueLogicalTrue: ValueLogical = makeLogical(true);
export const ValueLogicalFalse: ValueLogical = makeLogical(false);
export const ValueLogicalMaybe: ValueLogical = makeLogical('maybe');
export const ValueLogicalTop: ValueLogical = makeLogical(Top);
export const ValueLogicalBot: ValueLogical = makeLogical(Bottom);