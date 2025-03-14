import type { Lift, ValueInterval, ValueLogical } from '../r-value';
import { bottomTopGuard } from '../general';
import { checkInterval } from './interval-check';
import { binaryInterval } from './interval-binary';
import { iteLogical } from '../logical/logical-check';
import { ValueLogicalMaybe } from '../logical/logical-constants';
import { compareScalar } from '../scalar/scalar-compare';
import { getIntervalEnd, getIntervalStart } from './interval-constants';

const CompareOperations = {
	'<=': intervalLeq,
} as const;

export function compareInterval<A extends ValueInterval, B extends ValueInterval>(a: A, b: B, op: keyof typeof CompareOperations): Lift<ValueLogical> {
	return bottomTopGuard(a, b) ?? CompareOperations[op](a as ValueInterval, b as ValueInterval);
}

function intervalLeq<A extends ValueInterval, B extends ValueInterval>(a: A, b: B): Lift<ValueLogical> {
	// if intersect af a and b is non-empty, return maybe
	// else return a.end <= b.start
	const intersect = binaryInterval(a, b, 'intersect');

	return iteLogical(
		checkInterval(intersect, 'empty'),
		ValueLogicalMaybe,
		compareScalar(
			getIntervalEnd(a),
			getIntervalStart(b),
			'<='
		)
	);
}