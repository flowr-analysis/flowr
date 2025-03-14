import { assert, describe, test } from 'vitest';


import { guard } from '../../../../../src/util/assert';
import type { Lift, ValueLogical } from '../../../../../src/dataflow/eval/values/r-value';
import { isBottom, isTop } from '../../../../../src/dataflow/eval/values/r-value';
import {
	ValueLogicalFalse,
	ValueLogicalMaybe,
	ValueLogicalTrue
} from '../../../../../src/dataflow/eval/values/logical/logical-constants';
import { unaryLogical } from '../../../../../src/dataflow/eval/values/logical/logical-unary';
import { binaryLogical } from '../../../../../src/dataflow/eval/values/logical/logical-binary';

describe('logical', () => {
	function shouldBeBool(value: Lift<ValueLogical>, expect: boolean | 'maybe') {
		if(typeof expect === 'boolean' || expect === 'maybe') {
			guard(!isTop(value) && !isBottom(value));
			assert.equal(value.value, expect);
		}
	}
	describe('unary', () => {
		test.each([
			{ label: '(sanity) should be one', value: ValueLogicalTrue, expect: true },
			{ label: 'not should work', value: unaryLogical(ValueLogicalTrue, 'not'), expect: false },
		])('$label', ({ value, expect }) => {
			shouldBeBool(value, expect);
		});
	});
	describe('binary', () => {
		test.each([
			{ label: '1 && 1', value: binaryLogical(ValueLogicalTrue, ValueLogicalTrue, 'and'), expect: true },
			{ label: '1 && 0', value: binaryLogical(ValueLogicalTrue, ValueLogicalFalse, 'and'), expect: false },
			{ label: '1 && ?', value: binaryLogical(ValueLogicalTrue, ValueLogicalMaybe, 'and'), expect: 'maybe' as const },
			{ label: '1 && ?', value: binaryLogical(ValueLogicalTrue, ValueLogicalMaybe, 'and'), expect: 'maybe' as const },
			{ label: '? && ?', value: binaryLogical(ValueLogicalMaybe, ValueLogicalMaybe, 'and'), expect: 'maybe' as const },
			{ label: '? implies 0', value: binaryLogical(ValueLogicalMaybe, ValueLogicalFalse, 'implies'), expect: 'maybe' as const },
			{ label: '0 implies ?', value: binaryLogical(ValueLogicalFalse, ValueLogicalMaybe, 'implies'), expect: true },
			{ label: '1 iff 1', value: binaryLogical(ValueLogicalTrue, ValueLogicalTrue, 'iff'), expect: true },
			{ label: '0 iff 1', value: binaryLogical(ValueLogicalFalse, ValueLogicalTrue, 'iff'), expect: false },
			{ label: '0 iff ?', value: binaryLogical(ValueLogicalFalse, ValueLogicalMaybe, 'iff'), expect: 'maybe' as const },
			{ label: '? iff ?', value: binaryLogical(ValueLogicalMaybe, ValueLogicalMaybe, 'iff'), expect: 'maybe' as const },
		])('$label', ({ value, expect }) => {
			shouldBeBool(value, expect);
		});
	});
});