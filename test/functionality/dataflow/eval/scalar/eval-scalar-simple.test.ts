import { assert, describe, test } from 'vitest';
import {
	getScalarFromInteger,
	ValueIntegerOne,
	ValueIntegerZero
} from '../../../../../src/dataflow/eval/values/scalar/scalar-constants';
import { guard } from '../../../../../src/util/assert';
import { unaryScalar } from '../../../../../src/dataflow/eval/values/scalar/scalar-unary';
import type { Lift, ValueNumber } from '../../../../../src/dataflow/eval/values/r-value';
import { isBottom, isTop } from '../../../../../src/dataflow/eval/values/r-value';
import { binaryScalar } from '../../../../../src/dataflow/eval/values/scalar/scalar-binary';

describe('scalar', () => {
	function shouldBeNum(value: Lift<ValueNumber>, expect: number, shouldBeInt = false, shouldBeFloat = false) {
		if(typeof expect === 'number') {
			guard(!isTop(value) && !isBottom(value));
			guard('num' in value.value);
			assert.equal(value.value.num, expect);
		}
	}
	describe('unary', () => {
		test.each([
			{ label: '(sanity) should be one', value: ValueIntegerOne, expect: 1 },
			{ label: 'negate should work', value: unaryScalar(ValueIntegerOne, 'negate'), expect: -1 },
		])('$label', ({ value, expect }) => {
			shouldBeNum(value, expect);
		});
	});
	describe('binary', () => {
		test.each([
			{ label: '1 + 1', value: binaryScalar(ValueIntegerOne, 'add', ValueIntegerOne), expect: 2 },
			{ label: '1 + 0', value: binaryScalar(ValueIntegerOne, 'add', ValueIntegerZero), expect: 1 },
			{ label: '1 - 1', value: binaryScalar(ValueIntegerOne, 'sub', ValueIntegerOne), expect: 0 },
			{ label: '1 * 0', value: binaryScalar(ValueIntegerOne, 'mul', ValueIntegerZero), expect: 0 },
			{ label: '1 * 2', value: binaryScalar(ValueIntegerOne, 'mul', getScalarFromInteger(2)), expect: 2 },
			{ label: 'mod(5, 2)', value: binaryScalar(getScalarFromInteger(5), 'mod', getScalarFromInteger(2)), expect: 1 },
			{ label: 'mod(5, 3)', value: binaryScalar(getScalarFromInteger(5), 'mod', getScalarFromInteger(3)), expect: 2 },
		])('$label', ({ value, expect }) => {
			shouldBeNum(value, expect);
		});
	});
});