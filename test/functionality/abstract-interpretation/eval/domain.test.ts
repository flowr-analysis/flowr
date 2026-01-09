import { describe, test } from 'vitest';
import type { Domain, Lift } from '../../../../src/abstract-interpretation/eval/domain';
import { Bottom, isBottom, isTop, Top } from '../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import type { Const } from '../../../../src/abstract-interpretation/eval/domains/constant';
import { ConstDomain } from '../../../../src/abstract-interpretation/eval/domains/constant';
import { ConstSetDomain } from '../../../../src/abstract-interpretation/eval/domains/constant-set';

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

	const domains: Domain<any>[] = [ConstDomain, ConstSetDomain];
	const getElementCases = (domain: Domain<any>) => {
		const common: Lift<any>[] = [
			['foo', Top, true],
			['foo', Bottom, false],
		];

		if(domain === ConstDomain) {
			return common.concat([
				['foo', { kind: 'const', value: 'foo' }, true],
				['foo', { kind: 'const', value: 'bar' }, false],
			]);
		} else if(domain === ConstSetDomain) {
			return common.concat([
				['foo', { kind: 'const-set', value: ['foo'] }, true],
				['foo', { kind: 'const-set', value: ['foo', 'bar'] }, true],
				['foo', { kind: 'const-set', value: ['bar'] }, false],
			]);
		} else {
			throw'unreachable';
		}
	};

	describe.each(domains)('domain %s', (domain) => {
		const elementCases = getElementCases(domain);

		test.each(elementCases)('represents(%s, %o) == %d', (value, domainValue, expected) => {
			assert(domain.represents(value, domainValue) === expected);
		});
	});

});
