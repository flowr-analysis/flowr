import type { Lift, TernaryLogical, ValueLogical } from '../r-value';
import { Bottom , Top } from '../r-value';
import { bottomTopGuardSingle } from '../general';

export function unpackLogical(a: Lift<ValueLogical>): Lift<TernaryLogical> {
	return bottomTopGuardSingle(a) ?? (a as ValueLogical).value;
}

export function iteLogical<A extends Lift<ValueLogical>, Result>(
	cond: A,
	onTrue: Lift<Result>,
	onFalse: Lift<Result>,
	onMaybe: Lift<Result> = Top
): Lift<Result> {
	const condVal = unpackLogical(cond);
	if(condVal === Top) {
		return Top;
	} else if(condVal === Bottom) {
		return Bottom;
	} else if(condVal === 'maybe') {
		return onMaybe;
	} else {
		return condVal ? onTrue : onFalse;
	}
}