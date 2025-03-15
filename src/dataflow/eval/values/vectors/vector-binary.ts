import type { Value, ValueVector } from '../r-value';
import { isBottom, isTop } from '../r-value';
import { vectorFrom } from './vector-constants';
import { bottomTopGuard } from '../general';
import { binaryValue } from '../value-binary';
import { ValueLogicalBot, ValueLogicalTop, ValueLogicalTrue } from '../logical/logical-constants';

/**
 * Take two potentially lifted vectors and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryVector<A extends ValueVector, B extends ValueVector>(
	a: A,
	op: string,
	b: B
): ValueVector {
	if(op in VectorBinaryOperations) {
		return VectorBinaryOperations[op](a as ValueVector, b as ValueVector);
	} else {
		return applyPairWiseRecycle(a, op, b);
	}
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
	return [a, vectorFrom(...bElements)];
}

function applyPairWiseRecycle(
	a: ValueVector,
	op: string,
	b: ValueVector
): ValueVector {
	const bt = bottomTopGuard(a.elements, b.elements);
	if(bt) {
		return vectorFrom(bt);
	} else if((a as ValueVector<Value[]>).elements.length === 0 || (b as ValueVector<Value[]>).elements.length === 0) {
		return vectorFrom();
	}
	const [aV, bV] = recycleUntilEqualLength(a as ValueVector<Value[]>, b as ValueVector<Value[]>);
	console.log(aV, bV);
	return vectorFrom(
		...aV.elements
			.map((a, i) => binaryValue(a, op, bV.elements[i]))
	);
}

const VectorBinaryOperations = {
	'===': (a, b) => {
		const res = applyPairWiseRecycle(a, '===', b);
		if(isTop(res.elements)) {
			return ValueLogicalTop;
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
