import type { ValueLogical, ValueString } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RStringValue } from '../../../../r-bridge/lang-4.x/convert-values';
import type { ValueCompareOperation } from '../value-compare';
import { liftLogical } from '../logical/logical-constants';

/**
 * Take two potentially lifted intervals and compare them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function compareString<A extends ValueString, B extends ValueString>(
	a: A,
	op: keyof typeof Operations,
	b: B
): ValueLogical {
	return Operations[op](a as ValueString, b as ValueString);
}

const Operations = {
	'<=':  (a, b) => stringHelper(a, b, (a, b) => a <= b),
	'<':   (a, b) => stringHelper(a, b, (a, b) => a < b),
	'>=':  (a, b) => stringHelper(a, b, (a, b) => a >= b),
	'>':   (a, b) => stringHelper(a, b, (a, b) => a > b),
	'==':  (a, b) => stringHelper(a, b, (a, b) => a === b),
	'!=':  (a, b) => stringHelper(a, b, (a, b) => a !== b),
	'===': (a, b) => stringHelper(a, b, (a, b) => a === b),
	'!==': (a, b) => stringHelper(a, b, (a, b) => a !== b),
	/* we do subsets as includes */
	'⊆':   (a, b) => stringHelper(a, b, (a, b) => b.includes(a)),
	'⊂':   (a, b) => stringHelper(a, b, (a, b) => b.includes(a) && a !== b),
	'⊇':   (a, b) => stringHelper(a, b, (a, b) => a.includes(b)),
	'⊃':   (a, b) => stringHelper(a, b, (a, b) => a.includes(b) && a !== b)
} as const satisfies Record<ValueCompareOperation, (a: ValueString, b: ValueString) => ValueLogical>;

function stringHelper<A extends ValueString, B extends ValueString>(
	a: A,
	b: B,
	c: (a: string, b: string) => boolean
): ValueLogical {
	const val = bottomTopGuard(a.value, b.value);
	const aval = a.value as RStringValue;
	const bval = b.value as RStringValue;
	/** we ignore the string markers */
	return liftLogical(val ?? c(aval.str, bval.str));
}