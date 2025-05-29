import { assert, describe, test } from 'vitest';
import type { Value } from '../../../../../src/dataflow/eval/values/r-value';
import {
	liftLogical,
	ValueLogicalFalse,
	ValueLogicalMaybe,
	ValueLogicalTrue
} from '../../../../../src/dataflow/eval/values/logical/logical-constants';
import { unaryLogical } from '../../../../../src/dataflow/eval/values/logical/logical-unary';
import { binaryLogical } from '../../../../../src/dataflow/eval/values/logical/logical-binary';
import { isTruthy } from '../../../../../src/dataflow/eval/values/logical/logical-check';
import { binaryValue } from '../../../../../src/dataflow/eval/values/value-binary';

describe('logical', () => {
	function shouldBeBool(value: Value, expect: boolean | 'maybe') {
		const truthy = isTruthy(binaryValue(value, '===', liftLogical(expect)));
		assert.isTrue(truthy);
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
			{ label: '1 && 1', value: binaryLogical(ValueLogicalTrue, 'and', ValueLogicalTrue), expect: true },
			{ label: '1 && 0', value: binaryLogical(ValueLogicalTrue, 'and', ValueLogicalFalse), expect: false },
			{ label: '1 && ?', value: binaryLogical(ValueLogicalTrue, 'and', ValueLogicalMaybe), expect: 'maybe' as const },
			{ label: '1 && ?', value: binaryLogical(ValueLogicalTrue, 'and', ValueLogicalMaybe), expect: 'maybe' as const },
			{ label: '? && ?', value: binaryLogical(ValueLogicalMaybe, 'and', ValueLogicalMaybe), expect: 'maybe' as const },
			{ label: '? implies 0', value: binaryLogical(ValueLogicalMaybe, 'implies', ValueLogicalFalse), expect: 'maybe' as const },
			{ label: '0 implies ?', value: binaryLogical(ValueLogicalFalse, 'implies', ValueLogicalMaybe), expect: true },
			{ label: '1 iff 1', value: binaryLogical(ValueLogicalTrue, 'iff', ValueLogicalTrue), expect: true },
			{ label: '0 iff 1', value: binaryLogical(ValueLogicalFalse, 'iff', ValueLogicalTrue), expect: false },
			{ label: '0 iff ?', value: binaryLogical(ValueLogicalFalse, 'iff', ValueLogicalMaybe), expect: 'maybe' as const },
			{ label: '? iff ?', value: binaryLogical(ValueLogicalMaybe, 'iff', ValueLogicalMaybe), expect: 'maybe' as const },
		])('$label', ({ value, expect }) => {
			shouldBeBool(value, expect);
		});
	});
});