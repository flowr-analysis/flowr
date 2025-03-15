import type { ValueLogical } from '../r-value';
import { logicalToInterval } from './logical-unary';
import type { ValueCompareOperation } from '../value-compare';
import { compareInterval } from '../intervals/interval-compare';


export function compareLogical<A extends ValueLogical, B extends ValueLogical>(
	a: A,
	op: ValueCompareOperation,
	b: B
): ValueLogical {
	return compareInterval(
		logicalToInterval(a),
		op,
		logicalToInterval(b)
	);
}
