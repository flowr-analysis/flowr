import type { Value, ValueSet } from '../r-value';
import { stringifyValue, Top , isBottom, isTop } from '../r-value';
import { bottomTopGuard } from '../general';
import { binaryValue } from '../value-binary';
import { ValueLogicalBot, ValueLogicalTop, ValueLogicalTrue } from '../logical/logical-constants';
import { setFrom } from './set-constants';
import { expensiveTrace } from '../../../../util/log';
import { ValueEvalLog } from '../../eval';

/**
 * Take two potentially lifted sets and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function binarySet(
	a: ValueSet,
	op: string,
	b: ValueSet
): ValueSet {
	let res: Value = Top;
	if(op in SetBinaryOperations) {
		res = SetBinaryOperations[op](a, b);
	} else {
		res = cartesianProduct(a, op, b);
	}
	expensiveTrace(ValueEvalLog, () => ` * binarySet(${stringifyValue(a)}, ${op}, ${stringifyValue(b)}) = ${stringifyValue(res)}`);
	return res;
}

function cartesianProduct(
	a: ValueSet,
	op: string,
	b: ValueSet
): ValueSet {
	const bt = bottomTopGuard(a.elements, b.elements);
	if(bt) {
		return setFrom(bt);
	} else if((a as ValueSet<Value[]>).elements.length === 0 || (b as ValueSet<Value[]>).elements.length === 0) {
		return setFrom();
	}
	const elements: Value[] = [];
	for(const aElement of (a.elements as Value[])) {
		for(const bElement of (b.elements as Value[])) {
			elements.push(binaryValue(aElement, op, bElement));
		}
	}
	return setFrom(...elements);
}

const SetBinaryOperations = {
	'===': (a, b) => {
		const res = cartesianProduct(a, '===', b);
		// TODO: what if multiple possbiilities, this should only check if one of them works
		if(isTop(res.elements)) {
			return ValueLogicalTop;
		} else if(isBottom(res.elements)) {
			return ValueLogicalBot;
		} else {
			if(res.elements.length === 0) {
				return ((a as ValueSet<Value[]>).elements.length === 0 || (b as ValueSet<Value[]>).elements.length === 0)
					? ValueLogicalTrue : ValueLogicalBot;
			}
			return res.elements.reduce((acc, cur) => binaryValue(acc, 'and', cur), ValueLogicalTrue);
		}
	},
	// TODO %*% etc.
	/*
	first: a => vectorFrom(a.elements[0]),
	last:  a => vectorFrom(a.elements[a.elements.length - 1]),
	 */
} as Record<string, (a: ValueSet, b: ValueSet) => ValueSet>;

// TODO: support sin clamp to [-1, 1] etc.
