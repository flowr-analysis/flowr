import type { Value, ValueLogical } from '../r-value';
import { stringifyValue , isBottom, isTop ,  Bottom , Top } from '../r-value';
import type { CanBeLazy } from '../../../../util/lazy';
import { force } from '../../../../util/lazy';
import { liftLogical, ValueLogicalBot, ValueLogicalTop, ValueLogicalTrue } from './logical-constants';
import { binaryScalar } from '../scalar/scalar-binary';
import { ValueIntegerZero } from '../scalar/scalar-constants';
import { binaryString } from '../string/string-binary';
import { ValueEmptyString } from '../string/string-constants';
import { unaryInterval } from '../intervals/interval-unary';
import { binaryValue } from '../value-binary';
import { expensiveTrace } from '../../../../util/log';
import { ValueEvalLog } from '../../eval';

// TODO: truthy unary checks
export function toTruthy(a: Value): ValueLogical {
	expensiveTrace(ValueEvalLog, () => ` * isTruthy(${stringifyValue(a)})`);
	if(a === Top) {
		return ValueLogicalTop;
	} else if(a === Bottom) {
		return ValueLogicalBot;
	} else if(a.type === 'logical') {
		return a;
	} else if(a.type === 'number') {
		return binaryScalar(a, '!==', ValueIntegerZero) as ValueLogical;
	} else if(a.type === 'string') {
		return binaryString(a, '!==', ValueEmptyString) as ValueLogical;
	} else if(a.type === 'interval') {
		return unaryInterval(a, 'hasZero') as ValueLogical;
	} else if(a.type === 'vector') {
		return isTop(a.elements) || isBottom(a.elements) ? liftLogical(a.elements) :
			a.elements.length !== 0 ? ValueLogicalBot :
				toTruthy(a.elements[0]);
	} else if(a.type === 'set') {
		return isTop(a.elements) || isBottom(a.elements) ? liftLogical(a.elements) :
			a.elements.reduce((acc, el) => binaryValue(acc, 'or', toTruthy(el)), ValueLogicalTrue) as ValueLogical;
	}
	return ValueLogicalTop;
}

export function isTruthy(a: Value): boolean {
	return toTruthy(a).value === true;
}

interface IteCases<Result> {
	readonly onTrue:   CanBeLazy<Result>;
	readonly onFalse:  CanBeLazy<Result>;
	readonly onMaybe:  CanBeLazy<Result>;
	readonly onTop:    CanBeLazy<Result>;
	readonly onBottom: CanBeLazy<Result>;
}

export function iteLogical<Result>(
	cond: Value,
	{ onTrue, onFalse, onMaybe, onTop, onBottom }: IteCases<Result>
): Result {
	const condVal = toTruthy(cond).value;
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