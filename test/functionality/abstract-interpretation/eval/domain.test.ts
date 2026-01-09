import { describe, test } from 'vitest';
import { Bottom, isBottom, isTop, isValue, Top } from '../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import type { Const } from '../../../../src/abstract-interpretation/eval/domains/constant';

describe('String Domain', () => {
	test('isTop', () => {
		const topValue = Top;
		const constValue: Const = {
			kind:  'const',
			value: 'foobar',
		};
    
		assert(isTop(topValue));
		assert(!isTop(constValue));
	});

	test('isBottom', () => {
		const bottomValue = Bottom;
		const constValue: Const = {
			kind:  'const',
			value: 'foobar',
		};
    
		assert(isBottom(bottomValue));
		assert(!isBottom(constValue));
	});

	test('isValue', () => {
		const topValue = Top;
		const bottomValue = Bottom;
		const constValue: Const = {
			kind:  'const',
			value: 'foobar',
		};
    
		assert(isValue(constValue));
		assert(!isValue(topValue));
		assert(!isValue(bottomValue));
	});
});
