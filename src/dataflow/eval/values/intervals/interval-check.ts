import type { Lift, ValueInterval, ValueLogical } from '../r-value';
import { liftLogical, ValueLogicalFalse } from '../logical/logical-constants';
import { compareInterval } from './interval-compare';
import { ValueIntervalZero } from './interval-constants';
import { compareScalar } from '../scalar/scalar-compare';
import { binaryLogical } from '../logical/logical-binary';

const CheckOperations = {
	/** check if the interval contains no values */
	empty:   intervalEmpty,
	/** check if the interval contains exactly one value */
	scalar:  intervalScalar,
	hasZero: a => compareInterval(ValueIntervalZero, '⊆', a)
} as const as Record<string, (a: ValueInterval) => ValueLogical>;

export function checkInterval<A extends Lift<ValueInterval>>(a: A, op: keyof typeof CheckOperations): ValueLogical {
	return CheckOperations[op](a as ValueInterval);
}

function intervalEmpty<A extends ValueInterval>(a: A): ValueLogical {
	return binaryLogical(
		compareScalar(a.start, '>', a.end),
		'or',
		binaryLogical(
			compareScalar(a.start, '===', a.end),
			'and',
			liftLogical(!a.startInclusive || !a.endInclusive)
		)
	);
}

function intervalScalar<A extends ValueInterval>(a: A): ValueLogical {
	if(!a.startInclusive || !a.endInclusive) {
		return ValueLogicalFalse;
	} else {
		return compareScalar(a.start, '===', a.end);
	}
}
