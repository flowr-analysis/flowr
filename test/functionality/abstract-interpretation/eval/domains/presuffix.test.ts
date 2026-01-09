import { describe, test } from 'vitest';
import type { Lift } from '../../../../../src/abstract-interpretation/eval/domain';
import { Bottom, Top } from '../../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import type { Presuffix } from '../../../../../src/abstract-interpretation/eval/domains/presuffix';
import { longestCommonPrefix, longestCommonSuffix, PresuffixDomain } from '../../../../../src/abstract-interpretation/eval/domains/presuffix';
import { NodeEvaluator } from './common';

function e(value: string): Lift<Presuffix> {
	return {
		kind:   'presuffix',
		prefix: value,
		suffix: value,
		exact:  true,
	};
}

function ps(prefix: string, suffix: string): Lift<Presuffix> {
	return {
		kind:  'presuffix',
		prefix,
		suffix,
		exact: false,
	};
}

function assertExact(value: Lift<Presuffix>, expected: string) {
	assert(value.kind === 'presuffix', 'Expected a presuffix value, not Top or Bot');
	assert(value.exact, 'Expected exact value, but only got prefix and suffix');
	assert(value.prefix === expected, `Expected value "${expected}" but got "${value.prefix}"`);
}

function assertPresuf(value: Lift<Presuffix>, expectedPrefix: string, expectedSuffix: string) {
	assert(value.kind === 'presuffix', 'Expected a presuffix value, not Top or Bot');
	assert(!value.exact, 'Expected a prefix and suffix, not an exact value');
	assert(value.prefix === expectedPrefix, `Expected prefix "${expectedPrefix}" but got ${value.prefix}`);
	assert(value.suffix === expectedSuffix, `Expected suffix "${expectedSuffix}" but got ${value.suffix}`);
}

describe('String Domain: Presuffix', () => {
	const domain = PresuffixDomain;
	const ne = new NodeEvaluator(domain);

	test('longestCommonPrefix', () => {
		assert(longestCommonPrefix('abc', 'abcde') === 'abc');
		assert(longestCommonPrefix('abc', 'axcde') === 'a');
		assert(longestCommonPrefix('abc', 'a') === 'a');
		assert(longestCommonPrefix('abc', 'b') === '');
		assert(longestCommonPrefix('', 'b') === '');
	});

	test('longestCommonSuffix', () => {
		assert(longestCommonSuffix('abcde', 'cde') === 'cde');
		assert(longestCommonSuffix('abcxe', 'cde') === 'e');
		assert(longestCommonSuffix('z', 'xyz') === 'z');
		assert(longestCommonSuffix('xyz', 'y') === '');
		assert(longestCommonSuffix('', 'b') === '');
	});

	const equalityCases: [Lift<Presuffix>, Lift<Presuffix>, boolean][] = [
		[Top, Top, true],
		[Bottom, Bottom, true],
		[Top, Bottom, false],
		[Top, e('foo'), false],
		[Bottom, e('foo'), false],
		[Top, ps('foo', 'bar'), false],
		[Bottom, ps('foo', 'bar'), false],
		[e('foo'), e('foo'), true],
		[e('foo'), e('bar'), false],
		[ps('foo', 'bar'), ps('foo', 'bar'), true],
		[ps('foo', 'bar'), ps('bar', 'foo'), false],
		[ps('fo', 'ar'), ps('foo', 'bar'), false],
		[e('foo'), ps('foo', 'foo'), false],
		[e('foo'), ps('foo', 'bar'), false],
	];
	test.each(equalityCases)('equality: (%j == %j) == %s', (l, r, v) => {
		assert(domain.equals(l, r) === v);
		assert(domain.equals(r, l) === v);
	});

	const sprintfCases: [Lift<Presuffix>, Lift<Presuffix>[], Lift<Presuffix>][] = [
		[Top, [], Top],
		[e('foo'), [], e('foo')],
		[e('%s'), [Top], Top],
		[e('%s'), [e('bar')], e('bar')],
		[e('%s%s'), [e('foo'), e('bar')], e('foobar')],
		[e('%s%s'), [e('foo'), Top], Top],
		[e('%d'), [e('5')], e('5')],
		[e('%.2f'), [e('0.33333')], e('0.33')],
		[e('%x'), [e('15')], e('f')],
		[ps('foo', 'bar'), [], Top],
		[e('%s'), [ps('foo', 'bar')], Top],
	];
	test.each(sprintfCases)('sprintf: fmt %j with args %j == %j', (fmt, args, result) => {
		const value = ne.function('sprintf', [fmt, ...args], []);
		assert(domain.equals(value, result), `was actually ${JSON.stringify(value)}`);
	});

	const elementCases: [string, Lift<Presuffix>, boolean][] = [
		['foo', Top, true],
		['foo', Bottom, false],
		['foo', e('foo'), true],
		['foo', ps('foo', 'foo'), true],
		['foo', ps('foo', ''), true],
		['foo', ps('', 'foo'), true],
		['foobeebar', e('foo'), false],
		['foobeebar', ps('foo', 'foo'), false],
		['foobeebar', ps('foo', 'bar'), true],
		['foo', ps('x', 'x'), false],
		['foo', e('x'), false],
	];
	test.each(elementCases)('%s represented by %j == %s', (string, value, expected) => {
		assert(domain.represents(string, value) === expected);
	});

	const leqCases: [Lift<Presuffix>, Lift<Presuffix>, boolean][] = [
		[Bottom, Top, true],
		[Bottom, e('foo'), true],
		[e('foo'), Top, true],
		[Bottom, e('bar'), true],
		[e('bar'), Top, true],
		[e('foo'), e('foo'), true],
		[e('foo'), e('bar'), false],
		[Bottom, ps('foo', 'bar'), true],
		[ps('foo', 'bar'), Top, true],
		[ps('foo', 'bar'), ps('f', 'r'), true],
		[ps('foo', 'bar'), ps('foo', ''), true],
		[ps('a', 'z'), ps('b', 'y'), false],
		[e('foo'), ps('foo', 'foo'), true],
		[e('foobar'), ps('foo', 'bar'), true],
	];
	test.each(leqCases)('%j <= %j == %s', (l, r, ordered) => {
		if(ordered) {
			assert(domain.leq(l, r), `${JSON.stringify(l)} should be <= ${JSON.stringify(r)} but was not`);
			if(domain.equals(l, r)) {
				assert(domain.leq(r, l), `${JSON.stringify(r)} should be <= ${JSON.stringify(l)} but was not`);
			} else {
				assert(!domain.leq(r, l), `${JSON.stringify(r)} should not be <= ${JSON.stringify(l)} but was`);
			}
		} else {
			assert(!domain.leq(l, r), `${JSON.stringify(l)} should not be <= ${JSON.stringify(r)} but was`);
			assert(!domain.leq(r, l), `${JSON.stringify(r)} should not be <= ${JSON.stringify(l)} but was`);
		}
	});

	test('operation: const', () => {
		assertExact(ne.const('foobar'), 'foobar');
	});

	test('operation: concat (single value)', () => {
		assertExact(ne.concat(e('sep'), e('foo')), 'foo');
		assertPresuf(ne.concat(Top, ps('foo', 'bar')), 'foo', 'bar');
		assert(ne.concat(e('sep'), Top).kind === 'top');
	});

	test('operation: concat (multiple values)', () => {
		assertExact(ne.concat(e('sep'), e('foo'), e('bar')), 'foosepbar');
		assertPresuf(ne.concat(Top, e('foo'), e('bar')), 'foo', 'bar');
		assertPresuf(ne.concat(Top, ps('foo', 'bee'), e('bar')), 'foo', 'bar');
		assertPresuf(ne.concat(ps('foo', 'bar'), e('foo'), e('bar')), 'foofoo', 'barbar');
		assertPresuf(ne.concat(e('sep'), e('foo'), ps('bee', 'boo'), e('bar')), 'foosepbee', 'boosepbar');
		assertPresuf(ne.concat(e('sep'), e('foo'), Top), 'foosep', '');
		assertPresuf(ne.concat(e('sep'), Top, e('bar')), '', 'sepbar');
		assert(ne.concat(e('sep'), Top, e('foobar'), Top).kind === 'top');
	});

	test('operation: join (single value)', () => {
		assertExact(ne.join(e('foo')), 'foo');
		assertPresuf(ne.join(ps('foo', 'bar')), 'foo', 'bar');
		assert(ne.join(Top).kind === 'top');
	});

	test('operation: join (multiple values)', () => {
		assert(ne.join(e('foo'), e('bar')).kind === 'top');
		assertPresuf(ne.join(e('foo'), e('foobar')), 'foo', '');
		assertPresuf(ne.join(e('foo'), e('foobarfoo')), 'foo', 'foo');
		assertPresuf(ne.join(e('foo'), e('faao')), 'f', 'o');
		assertPresuf(ne.join(e('foo'), ps('f', 'o')), 'f', 'o');
		assertPresuf(ne.join(e('foo'), ps('f', '')), 'f', '');
		assertPresuf(ne.join(e('foo'), ps('', 'o')), '', 'o');
		assertPresuf(ne.join(e('foo'), ps('fee', 'bo')), 'f', 'o');
		assertPresuf(ne.join(ps('foo', 'bar'), ps('foe', 'bor')), 'fo', 'r');
		assert(ne.join(ps('foo', 'bar'), Top).kind === 'top');
	});
});
