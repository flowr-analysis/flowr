import type { Lift, Value, ValueLogical, ValueNumber } from '../r-value';
import { stringifyValue,  Bottom } from '../r-value';
import { bottomTopGuard } from '../general';
import type { RNumberValue } from '../../../../r-bridge/lang-4.x/convert-values';
import { liftScalar, ValueIntegerBottom, ValueIntegerTop, ValueNumberEpsilon } from './scalar-constants';
import { liftLogical, ValueLogicalBot, ValueLogicalTop } from '../logical/logical-constants';
import { expensiveTrace } from '../../../../util/log';
import { ValueEvalLog } from '../../eval';
import { binaryInterval } from '../intervals/interval-binary';
import { intervalFromValues } from '../intervals/interval-constants';

/**
 * Take two potentially lifted intervals and combine them with the given op.
 * This propagates `top` and `bottom` values.
 */
export function binaryScalar(
	a: Lift<ValueNumber>,
	op: string,
	b: Lift<ValueNumber>
): Value {
	let res: Value | undefined = bottomTopGuard(a);
	if(op in ScalarBinaryOperations) {
		res ??= ScalarBinaryOperations[op as keyof typeof ScalarBinaryOperations](a, b);
	} else {
		res = binaryInterval(
			intervalFromValues(a, a),
			op,
			intervalFromValues(b, b)
		);
	}
	res ??= ValueIntegerTop;
	expensiveTrace(ValueEvalLog, () => ` * binaryScalar(${stringifyValue(a)}, ${op}, ${stringifyValue(b)}) = ${stringifyValue(res)}`);
	return res;
}


const ScalarBinaryOperations = {
	add:   (a, b) => scalarHelper(a, b, (a, b) => a + b),
	sub:   (a, b) => scalarHelper(a, b, (a, b) => a - b),
	mul:   (a, b) => scalarHelper(a, b, (a, b) => a * b),
	div:   (a, b) => scalarHelper(a, b, (a, b) => a / b),
	pow:   (a, b) => scalarHelper(a, b, (a, b) => a ** b),
	mod:   (a, b) => scalarHelper(a, b, (a, b) => a % b),
	max:   (a, b) => scalarMaxMin(a, b, 'max'),
	min:   (a, b) => scalarMaxMin(a, b, 'min'),
	'<=':  (a, b) => scalarHelperLogical(a, b, (a, b) => a <= b),
	'<':   (a, b) => scalarHelperLogical(a, b, (a, b) => a < b),
	'>=':  (a, b) => scalarHelperLogical(a, b, (a, b) => a >= b),
	'>':   (a, b) => scalarHelperLogical(a, b, (a, b) => a > b),
	'==':  (a, b) => scalarHelperLogical(a, b, (a, b) => identicalNumbersThreshold(a, b)),
	'!=':  (a, b) => scalarHelperLogical(a, b, (a, b) => !identicalNumbersThreshold(a, b)),
	'===': (a, b) => scalarHelperLogical(a, b, (a, b) => identicalNumbersThreshold(a, b)),
	'!==': (a, b) => scalarHelperLogical(a, b, (a, b) => !identicalNumbersThreshold(a, b)),
	/** subseteq is only fulfilled if they are the same */
	'⊆':   (a, b) => scalarHelperLogical(a, b, (a, b) => identicalNumbersThreshold(a, b)),
	/** subset is never fulfilled  */
	'⊂':   (a, b) => scalarHelperLogical(a, b, (_a, _b) => false),
	'⊇':   (a, b) => scalarHelperLogical(a, b, (a, b) => identicalNumbersThreshold(b, a)),
	'⊃':   (a, b) => scalarHelperLogical(a, b, (_a, _b) => false)
} as const satisfies Record<string, (a: Lift<ValueNumber>, b: Lift<ValueNumber>) => Value>;

export type ScalarBinaryOperation = typeof ScalarBinaryOperations;

function identicalNumbersThreshold(a: number, b: number): boolean {
	return a === b || Math.abs(a - b) < 2 * ValueNumberEpsilon.value.num;
}


function scalarHelperLogical(
	a: Lift<ValueNumber>,
	b: Lift<ValueNumber>,
	c: (a: number, b: number) => boolean
): ValueLogical {
	const val = bottomTopGuard(a, b, (a as ValueNumber).value, (b as ValueNumber).value);
	if(val) {
		return val === Bottom ? ValueLogicalBot : ValueLogicalTop;
	}
	const aval = (a as ValueNumber).value as RNumberValue;
	const bval = (b as ValueNumber).value as RNumberValue;
	return liftLogical(val ?? c(aval.num, bval.num));
}

function scalarHelper(
	a: Lift<ValueNumber>,
	b: Lift<ValueNumber>,
	c: (a: number, b: number) => number
): ValueNumber {
	const val = bottomTopGuard(a, b, (a as ValueNumber).value, (b as ValueNumber).value);
	if(val) {
		return val === Bottom ? ValueIntegerBottom : ValueIntegerTop;
	}
	const aval = (a as ValueNumber).value as RNumberValue;
	const bval = (b as ValueNumber).value as RNumberValue;
	/* do not calculate if top or bot */
	const result = c(aval.num, bval.num);
	return liftScalar({
		markedAsInt:   aval.markedAsInt && bval.markedAsInt && Number.isInteger(result),
		complexNumber: aval.complexNumber || bval.complexNumber,
		num:           result
	});
}

// max and min do not have to create knew objects
function scalarMaxMin(a: Lift<ValueNumber>, b: Lift<ValueNumber>, c: 'max' | 'min'): Lift<ValueNumber> {
	const bt = bottomTopGuard(a, b, (a as ValueNumber).value, (b as ValueNumber).value);
	if(bt) {
		return ValueIntegerTop;
	}
	const aval = (a as ValueNumber).value as RNumberValue;
	const bval = (b as ValueNumber).value as RNumberValue;
	const takeA = c === 'max' ? aval.num > bval.num : aval.num < bval.num;
	return takeA ? a : b;
}
