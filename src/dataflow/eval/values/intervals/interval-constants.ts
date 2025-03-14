import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';
import type { Lift, ValueInterval, ValueNumber } from '../r-value';
import { bottomTopGuardSingle } from '../general';

export function intervalFromScalar(scalar: RNumberValue) {
	return {
		type:           'interval',
		start:          scalar,
		end:            scalar,
		startInclusive: true,
		endInclusive:   true,
	};
}

export function getIntervalStart(interval: Lift<ValueInterval>): Lift<ValueNumber> {
	return applyIntervalOp(interval, op => op.start);
}

export function getIntervalEnd(interval: Lift<ValueInterval>): Lift<ValueNumber> {
	return applyIntervalOp(interval, op => op.end);
}

function applyIntervalOp<Out>(interval: Lift<ValueInterval>, op: (interval: ValueInterval) => Lift<Out>): Lift<Out> {
	return bottomTopGuardSingle(interval) ?? op(interval as ValueInterval);
}