import type { Value, ValueVector } from '../r-value';
import { vectorFrom } from './vector-constants';
import { bottomTopGuard } from '../general';
import { unaryValue } from '../value-unary';

/**
 * Take a potentially lifted vector and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function unaryVector<A extends ValueVector>(
	a: A,
	op: string
): ValueVector {
	if(op in VectorUnaryOperations) {
		return VectorUnaryOperations[op](a as ValueVector);
	} else {
		return applyComponentWise(a, op);
	}
}

function applyComponentWise(
	a: ValueVector,
	op: string
): ValueVector {
	const bt = bottomTopGuard(a.elements);
	return bt ? vectorFrom(bt) : vectorFrom(
		...(a as ValueVector<Value[]>).elements
			.map((a) => unaryValue(a, op))
	);
}

const VectorUnaryOperations: Record<string, (a: ValueVector) => ValueVector> = {
	id: a => a,
	/*
	first: a => vectorFrom(a.elements[0]),
	last:  a => vectorFrom(a.elements[a.elements.length - 1]),
	 */
};

// TODO: support sin clamp to [-1, 1] etc.
