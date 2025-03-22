import type { Lift, Value, ValueVector } from '../r-value';
import { stringifyValue, Top , isBottom, isTop } from '../r-value';
import { vectorFrom } from './vector-constants';
import { bottomTopGuard } from '../general';
import { binaryValue } from '../value-binary';
import { ValueLogicalBot, ValueLogicalFalse, ValueLogicalTrue } from '../logical/logical-constants';
import { expensiveTrace } from '../../../../util/log';
import { ValueEvalLog } from '../../eval';
import { toTruthy } from '../logical/logical-check';

/**
 * Take two potentially lifted vectors and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryVector(
	a: ValueVector,
	op: string,
	b: ValueVector
): ValueVector {
	let res: Value = Top;
	if(op in VectorBinaryOperations) {
		res = VectorBinaryOperations[op](a, b);
	} else {
		res = applyPairWise(a, op, b, true);
	}
	expensiveTrace(ValueEvalLog, () => ` * binaryVector(${stringifyValue(a)}, ${op}, ${stringifyValue(b)}) = ${stringifyValue(res)}`);
	return res;
}

function recycleUntilEqualLength(
	a: ValueVector<Value[]>,
	b: ValueVector<Value[]>
): [ValueVector<Value[]>, ValueVector<Value[]>] {
	const aLen = a.elements.length;
	const bLen = b.elements.length;
	if(aLen === bLen) {
		return [a, b];
	}
	// make vectors same length reusing elements
	if(aLen < bLen) {
		const [x, y] = recycleUntilEqualLength(b, a);
		return [y, x];
	}
	const bElements = b.elements.slice();
	while(bElements.length < aLen) {
		bElements.push(bElements[bElements.length % bLen]);
	}
	return [a, vectorFrom({ elements: bElements, domain: b.elementDomain })];
}

function applyPairWise(
	a: ValueVector,
	op: string,
	b: ValueVector,
	recycle: boolean
): ValueVector {
	let elements: Lift<Value[]> | undefined = bottomTopGuard(a.elements, b.elements);
	if((a as ValueVector<Value[]>).elements.length === 0 || (b as ValueVector<Value[]>).elements.length === 0) {
		elements = [];
	}
	if(!elements) {
		const [aV, bV] = recycle ? recycleUntilEqualLength(a as ValueVector<Value[]>, b as ValueVector<Value[]>) : [a as ValueVector<Value[]>, b as ValueVector<Value[]>];
		elements = aV.elements
			.map((a, i) => bV.elements[i] ? binaryValue(a, op, bV.elements[i]) : Top);
	}
	const domain = bottomTopGuard(a.elementDomain) ?? binaryValue(a.elementDomain, op, b.elementDomain);
	return vectorFrom({
		elements,
		domain
	});
}

const VectorBinaryOperations = {
	'===': (a, b) => {
		if(a === b) {
			return ValueLogicalTrue;
		}
		const compareDomains = binaryValue(a.elementDomain, '===', b.elementDomain);
		if(!toTruthy(compareDomains)) {
			return ValueLogicalFalse;
		}
		const res = applyPairWise(a, '===', b, false);
		if(isTop(res.elements)) {
			return toTruthy(compareDomains);
		} else if(isBottom(res.elements)) {
			return ValueLogicalBot;
		} else {
			if(res.elements.length === 0) {
				return ((a as ValueVector<Value[]>).elements.length === 0 || (b as ValueVector<Value[]>).elements.length === 0)
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
} as Record<string, (a: ValueVector, b: ValueVector) => ValueVector>;
// TODO: support sin clamp to [-1, 1] etc.
