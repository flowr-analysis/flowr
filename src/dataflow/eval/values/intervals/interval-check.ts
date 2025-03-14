import type { Lift, ValueInterval, ValueLogical } from '../r-value';
import { bottomTopGuard } from '../general';

const CheckOperations = {
	'empty': intervalEmpty
} as const;

export function checkInterval<A extends Lift<ValueInterval>>(a: A, op: keyof typeof CheckOperations): Lift<ValueLogical> {
	return bottomTopGuard(a) ?? CheckOperations[op](a as ValueInterval);
}

function intervalEmpty<A extends ValueInterval>(a: A): ValueLogical {
	return {
		type:  'logical',
		value: a.start < a.end || (a.start === a.end && (!a.startInclusive || !a.endInclusive))
	};
}