import type { Lift, TernaryLogical, ValueLogical } from '../r-value';
import { Bottom , Top } from '../r-value';
import { bottomTopGuard } from '../general';
import type { CanBeLazy } from '../../../../util/lazy';
import { force } from '../../../../util/lazy';

export function unpackLogical(a: Lift<ValueLogical>): Lift<TernaryLogical> {
	return bottomTopGuard(a) ?? (a as ValueLogical).value;
}

interface IteCases<Result> {
	readonly onTrue:   CanBeLazy<Result>;
	readonly onFalse:  CanBeLazy<Result>;
	readonly onMaybe:  CanBeLazy<Result>;
	readonly onTop:    CanBeLazy<Result>;
	readonly onBottom: CanBeLazy<Result>;
}

export function iteLogical<A extends Lift<ValueLogical>, Result>(
	cond: A,
	{ onTrue, onFalse, onMaybe, onTop, onBottom }: IteCases<Result>
): Result {
	const condVal = unpackLogical(cond);
	if(condVal === Top) {
		return force(onTop);
	} else if(condVal === Bottom) {
		return force(onBottom);
	} else if(condVal === 'maybe') {
		return force(onMaybe);
	} else {
		return condVal ? force(onTrue) : force(onFalse);
	}
}