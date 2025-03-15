import type { ValueLogical, ValueNumber } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';
import type { ValueCompareOperation } from '../value-compare';
import { ValueNumberEpsilon } from './scalar-constants';
import { liftLogical } from '../logical/logical-constants';

/**
 * Take two potentially lifted intervals and compare them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function compareScalar<A extends ValueNumber, B extends ValueNumber>(
	a: A,
	op: keyof typeof Operations,
	b: B
): ValueLogical {
	return Operations[op](a as ValueNumber, b as ValueNumber);
}

function identicalNumbersThreshold(a: number, b: number): boolean {
	return Math.abs(a - b) < 2 * ValueNumberEpsilon.value.num;
}

const Operations = {
	'<=':  (a, b) => scalarHelper(a, b, (a, b) => a <= b),
	'<':   (a, b) => scalarHelper(a, b, (a, b) => a < b),
	'>=':  (a, b) => scalarHelper(a, b, (a, b) => a >= b),
	'>':   (a, b) => scalarHelper(a, b, (a, b) => a > b),
	'==':  (a, b) => scalarHelper(a, b, (a, b) => identicalNumbersThreshold(a, b)),
	'!=':  (a, b) => scalarHelper(a, b, (a, b) => !identicalNumbersThreshold(a, b)),
	'===': (a, b) => scalarHelper(a, b, (a, b) => identicalNumbersThreshold(a, b)),
	'!==': (a, b) => scalarHelper(a, b, (a, b) => !identicalNumbersThreshold(a, b)),
	/** subseteq is only fulfilled if they are the same */
	'⊆':   (a, b) => scalarHelper(a, b, (a, b) => identicalNumbersThreshold(a, b)),
	/** subset is never fulfilled  */
	'⊂':   (a, b) => scalarHelper(a, b, (_a, _b) => false),
	'⊇':   (a, b) => scalarHelper(a, b, (a, b) => identicalNumbersThreshold(b, a)),
	'⊃':   (a, b) => scalarHelper(a, b, (_a, _b) => false)
} as const satisfies Record<ValueCompareOperation, (a: ValueNumber, b: ValueNumber) => ValueLogical>;

function scalarHelper<A extends ValueNumber, B extends ValueNumber>(
	a: A,
	b: B,
	c: (a: number, b: number) => boolean
): ValueLogical {
	const val = bottomTopGuard(a.value, b.value);
	const aval = a.value as RNumberValue;
	const bval = b.value as RNumberValue;
	return liftLogical(val ?? c(aval.num, bval.num));
}