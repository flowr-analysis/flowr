import type { Lift, Value, ValueLogical, ValueString } from '../r-value';
import { stringifyValue , asValue, Bottom , isBottom , isTop, Top } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RStringValue } from '../../../../r-bridge/lang-4.x/convert-values';
import { guard } from '../../../../util/assert';
import { liftLogical, ValueLogicalBot, ValueLogicalTop } from '../logical/logical-constants';
import { expensiveTrace } from '../../../../util/log';
import { ValueEvalLog } from '../../eval';
import { liftString } from './string-constants';

/**
 * Take a potentially lifted strings and apply the given op.
 * This propagates `top` and `bottom` values.
 */
export function unaryString(
	a: Lift<ValueString>,
	op: string
): Value {
	let res: Value = Top;
	guard(op in StringUnaryOperations, `Unknown string unary operation: ${op}`);
	res = bottomTopGuard(a) ?? StringUnaryOperations[op as keyof typeof StringUnaryOperations](a);
	expensiveTrace(ValueEvalLog, () => ` * unaryString(${stringifyValue(a)}, ${op}) = ${stringifyValue(res)}`);
	return res;
}

const StringUnaryOperations = {
	id:      a => a,
	length:  a => stringHelper(a, a => a.length.toString()),
	isEmpty: a => stringCheck(a, a => a === ''),
	isBlank: a => stringCheck(a, a => a.trim() === ''),

} as const satisfies Record<string, (a: Lift<ValueString>) => Value>;

export type StringUnaryOperation = keyof typeof StringUnaryOperations;

function stringHelper(a: Lift<ValueString>, op: (a: string) => string, fallback: Value = Top): Value {
	if(isTop(a)) {
		return fallback;
	} else if(isBottom(a)) {
		return a;
	}
	const val = bottomTopGuard(a.value);
	const aval = a.value as RStringValue;
	return liftString(val ?? {
		flag:   aval.flag,
		quotes: aval.quotes,
		str:    op(aval.str)
	});
}


function stringCheck(a: Lift<ValueString>, c: (n: string) => boolean): ValueLogical {
	const val = bottomTopGuard(a);
	if(val) {
		return val === Bottom ? ValueLogicalBot : ValueLogicalTop;
	}
	a = asValue(a);
	if(isTop(a.value)) {
		return ValueLogicalTop;
	} else if(isBottom(a.value)) {
		return ValueLogicalBot;
	} else {
		return liftLogical(c(a.value.str));
	}
}



