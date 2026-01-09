import { describe, test } from 'vitest';
import { assert } from 'ts-essentials/dist/functions/assert';
import type { Domain, Lift, Value } from '../../../../src/abstract-interpretation/eval/domain';
import { Bottom, Top } from '../../../../src/abstract-interpretation/eval/domain';
import { ConstSetDomain } from '../../../../src/abstract-interpretation/eval/domains/constant-set';
import { ConstDomain } from '../../../../src/abstract-interpretation/eval/domains/constant';
import { PresuffixDomain } from '../../../../src/abstract-interpretation/eval/domains/presuffix';

describe('String Domain Equality', () => {
	const domains = [ConstDomain, ConstSetDomain, PresuffixDomain] as Domain<Value>[];
	const getTestValues = (domain: Domain<Value>) => {
		const common: Lift<Value>[] = [
			Top,
			Bottom,
		];

		if(domain === ConstDomain) {
			return common.concat([
				{ kind: 'const', value: 'foobar' },
				{ kind: 'const', value: 'barfoo' },
			]);
		} else if(domain === ConstSetDomain) {
			return common.concat([
				{ kind: 'const-set', value: ['foo'] },
				{ kind: 'const-set', value: ['foo', 'bar'] },
			]);
		} else if(domain === PresuffixDomain) {
			return common.concat([
				{ kind: 'presuffix', prefix: 'abc', suffix: 'xyz', exact: false },
				{ kind: 'presuffix', prefix: 'foo', suffix: 'foo', exact: true },
			]);
		} else {
			throw new Error('unreachable');
		}
	};

	describe.each(domains)('domain %s', (domain) => {
		const testValues = getTestValues(domain);
		const allPossibleCombinations = testValues.flatMap(l =>
			testValues.map((r) => [l, r])
		);

		test.each(allPossibleCombinations)('symmetry %j + %j', (l, r) => {
			// a => b <=> !a || b
			assert(!domain.equals(l, r) || domain.equals(r, l));
		});

		test.each(testValues)('identity %j', (value) => {
			assert(domain.equals(value, value));
		});

		test('top', () => {
			const value = testValues.at(-1);
			assert(value !== undefined);
			assert(!domain.equals(Top, value));
			assert(!domain.equals(Top, Bottom));
		});

		test('bottom', () => {
			const value = testValues.at(-1);
			assert(value !== undefined);
			assert(!domain.equals(Bottom, value));
		});
	});


	test('const', () => {
		assert(ConstDomain.equals({ kind: 'const', value: 'foo' }, { kind: 'const', value: 'foo' }));
		assert(!ConstDomain.equals({ kind: 'const', value: 'foo' }, { kind: 'const', value: 'bar' }));
	});

	test('const-set', () => {
		assert(ConstSetDomain.equals({ kind: 'const-set', value: ['foo', 'bar'] }, { kind: 'const-set', value: ['bar', 'foo'] }));
		assert(!ConstSetDomain.equals({ kind: 'const-set', value: ['foo'] }, { kind: 'const-set', value: ['bar'] }));
	});

	test('presuffix', () => {
		assert(PresuffixDomain.equals({ kind: 'presuffix', prefix: 'foo', suffix: 'foo', exact: false }, { kind: 'presuffix', prefix: 'foo', suffix: 'foo', exact: false }));
		assert(!PresuffixDomain.equals({ kind: 'presuffix', prefix: 'foo', suffix: 'foo', exact: false }, { kind: 'presuffix', prefix: 'foo', suffix: 'foo', exact: true }));
		assert(!PresuffixDomain.equals({ kind: 'presuffix', prefix: 'foo', suffix: 'foo', exact: false }, { kind: 'presuffix', prefix: 'foo', suffix: '', exact: false }));
	});
});
