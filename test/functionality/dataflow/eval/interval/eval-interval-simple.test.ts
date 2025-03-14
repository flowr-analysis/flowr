import { assert, describe, test } from 'vitest';


import { guard } from '../../../../../src/util/assert';
import type { Lift, ValueInterval } from '../../../../../src/dataflow/eval/values/r-value';
import { isBottom, isTop } from '../../../../../src/dataflow/eval/values/r-value';
import { binaryInterval } from '../../../../../src/dataflow/eval/values/intervals/interval-binary';
import { unaryInterval } from '../../../../../src/dataflow/eval/values/intervals/interval-unary';
import { intervalFrom } from '../../../../../src/dataflow/eval/values/intervals/interval-constants';

describe('interval', () => {
	function shouldBeInterval(val: Lift<ValueInterval>, expect: readonly [startInclusive: boolean, start: number, end: number, endInclusive: boolean]) {
		guard(
			!isTop(val) && !isBottom(val) &&
			!isTop(val.start) && !isBottom(val.start) &&
			!isTop(val.end) && !isBottom(val.end)
		);
		guard('num' in val.start.value && 'num' in val.end.value);
		assert.strictEqual(val.startInclusive, expect[0], 'startInclusive');
		assert.strictEqual(val.start.value.num, expect[1], 'start');
		assert.strictEqual(val.end.value.num, expect[2], 'end');
		assert.strictEqual(val.endInclusive, expect[3], 'endInclusive');
	}
	describe('unary', () => {
		test.each([
			{ label: '(sanity) should be one', value: intervalFrom(1), expect: [true, 1, 1, true] as const },
			{ label: 'negate should work', value: unaryInterval(intervalFrom(1), 'negate'), expect: [true, -1, -1, true] as const },
			{ label: 'negate should work for [2, 4]', value: unaryInterval(intervalFrom(2, 4), 'negate'), expect: [true, -4, -2, true] as const },
			{ label: 'negate should work for (2, 4]', value: unaryInterval(intervalFrom(2, 4, false), 'negate'), expect: [true, -4, -2, false] as const },
		])('$label', ({ value, expect }) => {
			shouldBeInterval(value, expect);
		});
	});
	describe('binary', () => {
		test.each([
			{ label: '1 + 1', value: binaryInterval(intervalFrom(1), intervalFrom(1), 'add'), expect: [true, 2, 2, true] as const },
		])('$label', ({ value, expect }) => {
			shouldBeInterval(value, expect);
		});
	});
});