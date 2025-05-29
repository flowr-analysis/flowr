import type { Value, ValueVector } from '../r-value';
import { stringifyValue, Top } from '../r-value';
import { vectorFrom } from './vector-constants';
import { bottomTopGuard } from '../general';
import { unaryValue } from '../value-unary';
import { expensiveTrace } from '../../../../util/log';
import { ValueEvalLog } from '../../eval';

/**
 * Take a potentially lifted vector and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function unaryVector<A extends ValueVector>(
	a: A,
	op: string
): ValueVector {
	let res: Value = Top;
	if(op in VectorUnaryOperations) {
		res = VectorUnaryOperations[op](a);
	} else {
		res = applyComponentWise(a, op);
	}
	expensiveTrace(ValueEvalLog, () => ` * unaryVector(${stringifyValue(a)}, ${op}) = ${stringifyValue(res)}`);
	return res;
}

function applyComponentWise(
	a: ValueVector,
	op: string
): ValueVector {
	const elements = bottomTopGuard(a.elements) ?? (a as ValueVector<Value[]>).elements
		.map((a) => unaryValue(a, op));
	const domain = bottomTopGuard(a.elementDomain) ?? unaryValue(a.elementDomain, op);
	return vectorFrom({
		elements,
		domain
	});
}

const VectorUnaryOperations: Record<string, (a: ValueVector) => ValueVector> = {
	id: a => a,
	/*
	first: a => vectorFrom(a.elements[0]),
	last:  a => vectorFrom(a.elements[a.elements.length - 1]),
	 */
};

// TODO: support sin clamp to [-1, 1] etc.
