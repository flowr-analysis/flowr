import type { Value, ValueSet } from '../r-value';
import { stringifyValue, Top } from '../r-value';
import { setFrom } from './set-constants';
import { bottomTopGuard } from '../general';
import { unaryValue } from '../value-unary';
import { expensiveTrace } from '../../../../util/log';
import { ValueEvalLog } from '../../eval';

/**
 * Take a potentially lifted set and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function unarySet<A extends ValueSet>(
	a: A,
	op: string
): ValueSet {
	let res: Value = Top;
	if(op in SetUnaryOperations) {
		res = SetUnaryOperations[op](a);
	} else {
		res = applyComponentWise(a, op);
	}
	expensiveTrace(ValueEvalLog, () => ` * unarySet(${stringifyValue(a)}, ${op}) = ${stringifyValue(res)}`);
	return res;
}

function applyComponentWise(
	a: ValueSet,
	op: string
): ValueSet {
	const bt = bottomTopGuard(a.elements);
	return bt ? setFrom(bt) : setFrom(
		...(a as ValueSet<Value[]>).elements
			.map((a) => unaryValue(a, op))
	);
}

const SetUnaryOperations: Record<string, (a: ValueSet) => ValueSet> = {
	id: a => a,
	/*
	first: a => setFrom(a.elements[0]),
	last:  a => setFrom(a.elements[a.elements.length - 1]),
	 */
};

// TODO: support sin clamp to [-1, 1] etc.
