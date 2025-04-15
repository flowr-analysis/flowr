import { assert, describe, test } from 'vitest';
import type { Value, ValueInterval } from '../../../../../src/dataflow/eval/values/r-value';
import { stringifyValue  } from '../../../../../src/dataflow/eval/values/r-value';
import { binaryInterval } from '../../../../../src/dataflow/eval/values/intervals/interval-binary';
import {
	intervalFrom, ValueIntervalBottom,
	ValueIntervalTop
} from '../../../../../src/dataflow/eval/values/intervals/interval-constants';
import {
	ValueIntegerOne,
	ValueNumberEpsilon
} from '../../../../../src/dataflow/eval/values/scalar/scalar-constants';
import { unaryInterval } from '../../../../../src/dataflow/eval/values/intervals/interval-unary';
import { binaryValue } from '../../../../../src/dataflow/eval/values/value-binary';
import { toTruthy } from '../../../../../src/dataflow/eval/values/logical/logical-check';
import { unaryValue } from '../../../../../src/dataflow/eval/values/value-unary';

function i(l: '[' | '(', lv: number, rv: number, r: ']' | ')') {
	return intervalFrom(lv, rv, l === '[', r === ']');
}

describe('interval', () => {
	function shouldBeInterval(val: Value, expect: Value) {
		const res = binaryValue(val, '===', expect);
		const t = toTruthy(res);
		assert.isTrue(
			t.type === 'logical' && t.value,
			`Expected ${stringifyValue(val)} to be ${stringifyValue(expect)}; but: ${stringifyValue(res)}`
		);
	}
	describe('unary', () => {
		const tests = [
			{ label: 'id', value: intervalFrom(1), expect: { type: 'interval', start: ValueIntegerOne, startInclusive: true, end: ValueIntegerOne, endInclusive: true } },
			{ label: 'negate', value: ValueIntervalTop, expect: ValueIntervalTop },
			{ label: 'negate', value: ValueIntervalBottom, expect: ValueIntervalBottom },
			{ label: 'negate', value: intervalFrom(1), expect: intervalFrom(-1) },
			{ label: 'negate', value: intervalFrom(2, 4), expect: i('[', -4, -2, ']') },
			{ label: 'negate', value: intervalFrom(2, 4, false), expect: i('[', -4, -2, ')') },
			{ label: 'negate', value: intervalFrom(2, 4, false, false), expect: i('(', -4, -2, ')') },
			{ label: 'abs', value: ValueIntervalTop, expect: ValueIntervalTop },
			{ label: 'abs', value: ValueIntervalBottom, expect: ValueIntervalBottom },
			{ label: 'abs', value: intervalFrom(1), expect: i('[', 1, 1, ']') },
			{ label: 'abs', value: intervalFrom(2, 4), expect: i('[', 2, 4, ']') },
			{ label: 'abs', value: intervalFrom(-1, 1), expect: i('[', 0, 1, ']') },
			{ label: 'abs', value: intervalFrom(-1, 1, false), expect: i('[', 0, 1, ']') },
			{ label: 'abs', value: intervalFrom(-1, 1, false, false), expect: i('[', 0, 1, ')') },
			{ label: 'abs', value: intervalFrom(-42, 12, false), expect: i('[', 0, 42, ')') },
			{ label: 'ceil', value: ValueIntervalTop, expect: ValueIntervalTop },
			{ label: 'ceil', value: ValueIntervalBottom, expect: ValueIntervalBottom },
			{ label: 'ceil', value: intervalFrom(1),  expect: i('[', 1, 1, ']') },
			{ label: 'ceil', value: intervalFrom(2, 4),  expect: i('[', 2, 4, ']') },
			{ label: 'ceil', value: intervalFrom(2, 4, false),  expect: i('[', 3, 4, ']') },
			{ label: 'ceil', value: intervalFrom(2, 4, false, false),  expect: i('[', 3, 4, ']') },
			{ label: 'ceil', value: intervalFrom(-1, 1),  expect: i('[', -1, 1, ']') },
			{ label: 'ceil', value: intervalFrom(-1, 1, false),  expect: i('[', 0, 1, ']') },
			{ label: 'ceil', value: intervalFrom(-1.5, 12),  expect: i('[', -1, 12, ']') },
			{ label: 'ceil', value: intervalFrom(-1.5, 12, false),  expect: i('[', -1, 12, ']') },
			{ label: 'floor', value: ValueIntervalTop, expect: ValueIntervalTop },
			{ label: 'floor', value: ValueIntervalBottom, expect: ValueIntervalBottom },
			{ label: 'floor', value: intervalFrom(1),  expect: i('[', 1, 1, ']') },
			{ label: 'floor', value: intervalFrom(2, 4),  expect: i('[', 2, 4, ']') },
			{ label: 'floor', value: intervalFrom(2, 4, false),  expect: i('[', 2, 4, ']') },
			{ label: 'floor', value: intervalFrom(2, 4, false, false),  expect: i('[', 2, 3, ']') },
			{ label: 'floor', value: intervalFrom(-1, 1),  expect: i('[', -1, 1, ']') },
			{ label: 'floor', value: intervalFrom(-1, 1, true, false),  expect: i('[', -1, 0, ']') },
			{ label: 'floor', value: intervalFrom(-1.5, 1),  expect: i('[', -2, 1, ']')  },
			{ label: 'floor', value: intervalFrom(-1.5, -1, true, false),  expect: i('[', -2, -2, ']')  },
			{ label: 'round', value: ValueIntervalTop, expect: ValueIntervalTop },
			{ label: 'round', value: ValueIntervalBottom, expect: ValueIntervalBottom },
			{ label: 'round', value: intervalFrom(1), expect: i('[', 1, 1, ']') },
			{ label: 'round', value: intervalFrom(2, 4), expect: i('[', 2, 4, ']') },
			{ label: 'round', value: intervalFrom(2, 4, false), expect: i('[', 2, 4, ']') },
			{ label: 'round', value: intervalFrom(2, 4, false, true), expect: i('[', 2, 4, ']') },
			{ label: 'round', value: intervalFrom(-1, 1), expect: i('[', -1, 1, ']') },
			{ label: 'round', value: intervalFrom(-1, 1.5), expect: i('[', -1, 2, ']')  },
			{ label: 'round', value: intervalFrom(-1, 1.5, false, true), expect: i('[', -1, 2, ']') },
			{ label: 'round', value: intervalFrom(-1, 1.5, false, false), expect: i('[', -1, 1, ']') },
			{ label: 'round', value: intervalFrom(-1.5, -1, false, false), expect: i('[', -1, -1, ']') },
			{ label: 'sign', value: ValueIntervalTop, expect: i('[', -1, 1, ']') },
			{ label: 'sign', value: ValueIntervalBottom, expect: ValueIntervalBottom },
			{ label: 'sign', value: intervalFrom(1), expect: i('[', 1, 1, ']') },
			{ label: 'sign', value: intervalFrom(2, 4), expect: i('[', 1, 1, ']') },
			{ label: 'sign', value: intervalFrom(2, 4, false), expect: i('[', 1, 1, ']') },
			{ label: 'sign', value: intervalFrom(-1, 1), expect: i('[', -1, 1, ']') },
			{ label: 'sign', value: intervalFrom(-42, 0, false), expect: i('[', -1, 0, ']')  },
			{ label: 'sign', value: intervalFrom(-42, 0, false, false), expect: i('[', -1, -1, ']')  },
			{ label: 'sign', value: intervalFrom(-1.5, -1, false, false), expect: i('[', -1, -1, ']') },
			{ label: 'flip', value: ValueIntervalTop, expect: ValueIntervalTop },
			{ label: 'flip', value: ValueIntervalBottom, expect: ValueIntervalBottom },
			{ label: 'flip', value: intervalFrom(1), expect: i('[', 1, 1, ']') },
			{ label: 'flip', value: intervalFrom(1, 2, true, false), expect: i('(', 1 / 2, 1, ']') },
			{ label: 'highest', value: ValueIntervalTop, expect: ValueIntervalTop },
			{ label: 'highest', value: ValueIntervalBottom, expect: ValueIntervalBottom },
			{ label: 'highest', value: intervalFrom(-42, 0), expect: i('[', 0, 0, ']')  },
			{ label: 'highest', value: intervalFrom(-1.5, -1, false, false), expect: i('[', -1 - ValueNumberEpsilon.value.num, -1 - ValueNumberEpsilon.value.num, ']') },
			{ label: 'lowest', value: ValueIntervalTop, expect: ValueIntervalTop },
			{ label: 'lowest', value: ValueIntervalBottom, expect: ValueIntervalBottom },
			{ label: 'lowest', value: intervalFrom(-42, 0), expect: i('[', -42, -42, ']')  },
			{ label: 'lowest', value: intervalFrom(-1.5, -1, false, false), expect: i('[', -1.5 + ValueNumberEpsilon.value.num, -1.5 + ValueNumberEpsilon.value.num, ']') },
			{ label: 'toClosed', value: ValueIntervalTop, expect: ValueIntervalTop },
			{ label: 'toClosed', value: ValueIntervalBottom, expect: ValueIntervalBottom },
			{ label: 'toClosed', value: intervalFrom(-1.5, 12, false), expect: i('[', -1.5 + ValueNumberEpsilon.value.num, 12, ']') },
		] as const;
		for(const t of tests) {
			describe(t.label, () => {
				test(t.label + ' ' + stringifyValue(t.value) + ' => ' + stringifyValue(t.expect), () => {
					shouldBeInterval(unaryInterval(t.value, t.label), t.expect);
				});
			});
		}
	});
	describe('binary', () => {
		const tests = [
			{ label: 'add', left: intervalFrom(1), right: intervalFrom(1), expect: i('[', 2, 2, ']') },
			{ label: 'add', left: intervalFrom(1), right: intervalFrom(0), expect: i('[', 1, 1, ']') },
			{ label: 'add', left: intervalFrom(-1, 1), right: intervalFrom(-2, 4, true, false), expect: i('[', -3, 5, ')') },
			{ label: 'add', left: intervalFrom(-3, -1, false, false), right: intervalFrom(-2, -1, false, false), expect: i('(', -5, -2, ')') },
			{ label: 'add', left: ValueIntervalTop, right: intervalFrom(1), expect: ValueIntervalTop },
			{ label: 'add', left: ValueIntervalBottom, right: intervalFrom(1), expect: ValueIntervalBottom },

			{ label: 'sub', left: intervalFrom(1), right: intervalFrom(1), expect: i('[', 0, 0, ']') },
			{ label: 'sub', left: intervalFrom(2, 8), right: intervalFrom(2, 3), expect: i('(', -1, 6, ']') },
			{ label: 'sub', left: intervalFrom(2, 8), right: intervalFrom(2, 3, false, false), expect: i('(', -1, 6, ']') },
			{ label: 'sub', left: intervalFrom(2, 8), right: intervalFrom(2, 3, true, false), expect: i('[', -1, 6, ')') },
			{ label: 'sub', left: intervalFrom(2, 8), right: intervalFrom(-2, -1, false, true), expect: i('[', 3, 10, ']') },

			{ label: 'sub', left: ValueIntervalTop, right: intervalFrom(1), expect: ValueIntervalTop },
			{ label: 'sub', left: ValueIntervalBottom, right: intervalFrom(1), expect: ValueIntervalBottom },

			{ label: 'mul', left: ValueIntervalTop, right: intervalFrom(1), expect: ValueIntervalTop },
			{ label: 'mul', left: ValueIntervalBottom, right: intervalFrom(1), expect: ValueIntervalBottom },
			{ label: 'mul', left: intervalFrom(1), right: intervalFrom(0), expect: i('[', 0, 0, ']') },
			{ label: 'mul', left: intervalFrom(1), right: intervalFrom(2), expect: i('[', 2, 2, ']') },
		] as const;

		for(const t of tests) {
			describe(t.label, () => {
				const commutative = ['add', 'mul'].includes(t.label);
				function f(l: ValueInterval, r: ValueInterval) {
					return test(stringifyValue(l) + ' ' + t.label + ' ' + stringifyValue(r)  + ' => ' + stringifyValue(t.expect), () => {
						shouldBeInterval(unaryValue(binaryInterval(l, t.label, r), 'toClosed'), unaryValue(t.expect, 'toClosed'));
					});
				}
				f(t.left, t.right);
				if(commutative && JSON.stringify(t.left) !== JSON.stringify(t.right)) {
					f(t.right, t.left);
				}
			});
		}
	});
});