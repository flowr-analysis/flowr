import type { Lift, Value, ValueLogical, ValueString } from '../r-value';
import { stringifyValue, Top , isBottom, isTop } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RStringValue } from '../../../../r-bridge/lang-4.x/convert-values';
import { liftLogical, ValueLogicalBot, ValueLogicalTop } from '../logical/logical-constants';
import { guard } from '../../../../util/assert';
import { expensiveTrace } from '../../../../util/log';
import { ValueEvalLog } from '../../eval';
import { liftString, ValueStringBot, ValueStringTop } from './string-constants';

/**
 * Take two potentially lifted intervals and compare them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryString(
	a: Lift<ValueString>,
	op: string,
	b: Lift<ValueString>
): Value {
	let res: Value = Top;
	guard(op in Operations, `Unknown string binary operation: ${op}`);
	res = bottomTopGuard(a) ?? Operations[op as keyof typeof Operations](a, b);
	expensiveTrace(ValueEvalLog, () => ` * binaryString(${stringifyValue(a)}, ${op}, ${stringifyValue(b)}) = ${stringifyValue(res)}`);
	return res;
}

const Operations = {
	'add': (a, b) => stringHelper(a, b, (a, b) => a + b),
	'<=':  (a, b) => stringCheck(a, b, (a, b) => a <= b),
	'<':   (a, b) => stringCheck(a, b, (a, b) => a < b),
	'>=':  (a, b) => stringCheck(a, b, (a, b) => a >= b),
	'>':   (a, b) => stringCheck(a, b, (a, b) => a > b),
	'==':  (a, b) => stringCheck(a, b, (a, b) => a === b),
	'!=':  (a, b) => stringCheck(a, b, (a, b) => a !== b),
	'===': (a, b) => stringCheck(a, b, (a, b) => a === b),
	'!==': (a, b) => stringCheck(a, b, (a, b) => a !== b),
	/* we do subsets as includes */
	'⊆':   (a, b) => stringCheck(a, b, (a, b) => b.includes(a)),
	'⊂':   (a, b) => stringCheck(a, b, (a, b) => b.includes(a) && a !== b),
	'⊇':   (a, b) => stringCheck(a, b, (a, b) => a.includes(b)),
	'⊃':   (a, b) => stringCheck(a, b, (a, b) => a.includes(b) && a !== b)
} as const satisfies Record<string, (a: Lift<ValueString>, b: Lift<ValueString>) => Value>;

function stringHelper(
	a: Lift<ValueString>,
	b: Lift<ValueString>,
	c: (a: string, b: string) => string
): ValueString {
	if(isTop(a) || isTop(b)) {
		return ValueStringTop;
	} else if(isBottom(a) || isBottom(b)) {
		return ValueStringBot;
	}
	const val = bottomTopGuard(a.value, b.value);
	const aval = a.value as RStringValue;
	const bval = b.value as RStringValue;
	/** we ignore the string markers */
	return liftString(val ?? {
		quotes: '"',
		flag:   undefined,
		str:    c(aval.str, bval.str)
	});
}

function stringCheck(
	a: Lift<ValueString>,
	b: Lift<ValueString>,
	c: (a: string, b: string) => boolean
): ValueLogical {
	if(isTop(a) || isTop(b)) {
		return ValueLogicalTop;
	} else if(isBottom(a) || isBottom(b)) {
		return ValueLogicalBot;
	}
	const val = bottomTopGuard(a.value, b.value);
	const aval = a.value as RStringValue;
	const bval = b.value as RStringValue;
	/** we ignore the string markers */
	return liftLogical(val ?? c(aval.str, bval.str));
}