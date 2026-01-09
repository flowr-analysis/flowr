import { describe, test } from 'vitest';
import type { Lift } from '../../../../../src/abstract-interpretation/eval/domain';
import { Top } from '../../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import type { Presuffix } from '../../../../../src/abstract-interpretation/eval/domains/presuffix';
import { longestCommonPrefix, longestCommonSuffix, PresuffixDomain } from '../../../../../src/abstract-interpretation/eval/domains/presuffix';
import { NodeEvaluator } from './common-ops';

function exact(value: string): Lift<Presuffix> {
	return {
		kind:   'presuffix',
		prefix: value,
		suffix: value,
		exact:  true,
	};
}

function presuf(prefix: string, suffix: string): Lift<Presuffix> {
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

describe('Presuffix String Domain', () => {
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

	test('operation: const', () => {
		const value = ne.const('foobar');
		assertExact(value, 'foobar');
	});

	test('operation: concat (single value)', () => {
		let value = ne.concat(exact('sep'), exact('foo'));
		assertExact(value, 'foo');

		value = ne.concat(Top, presuf('foo', 'bar'));
		assertPresuf(value, 'foo', 'bar');

		assert(ne.concat(exact('sep'), Top).kind === 'top');
	});

	test('operation: concat (multiple values)', () => {
		let value = ne.concat(exact('sep'), exact('foo'), exact('bar'));
		assertExact(value, 'foosepbar');

		value = ne.concat(Top, exact('foo'), exact('bar'));
		assertPresuf(value, 'foo', 'bar');

		value = ne.concat(Top, presuf('foo', 'bee'), exact('bar'));
		assertPresuf(value, 'foo', 'bar');

		value = ne.concat(presuf('foo', 'bar'), exact('foo'), exact('bar'));
		assertPresuf(value, 'foofoo', 'barbar');

		value = ne.concat(exact('sep'), exact('foo'), presuf('bee', 'boo'), exact('bar'));
		assertPresuf(value, 'foosepbee', 'boosepbar');

		value = ne.concat(exact('sep'), exact('foo'), Top);
		assertPresuf(value, 'foosep', '');

		value = ne.concat(exact('sep'), Top, exact('bar'));
		assertPresuf(value, '', 'sepbar');

		value = ne.concat(exact('sep'), Top, exact('foobar'), Top);
		assert(value.kind === 'top');
	});

	test('operation: join (single value)', () => {
		let value = ne.join(exact('foo'));
		assertExact(value, 'foo');

		value = ne.join(presuf('foo', 'bar'));
		assertPresuf(value, 'foo', 'bar');

		value = ne.join(Top);
		assert(value.kind === 'top');
	});

	test('operation: join (multiple values)', () => {
		let value = ne.join(exact('foo'), exact('bar'));
		assert(value.kind === 'top');

		value = ne.join(exact('foo'), exact('foobar'));
		assertPresuf(value, 'foo', '');

		value = ne.join(exact('foo'), exact('foobarfoo'));
		assertPresuf(value, 'foo', 'foo');

		value = ne.join(exact('foo'), exact('faao'));
		assertPresuf(value, 'f', 'o');

		value = ne.join(exact('foo'), presuf('f', 'o'));
		assertPresuf(value, 'f', 'o');

		value = ne.join(exact('foo'), presuf('f', ''));
		assertPresuf(value, 'f', '');

		value = ne.join(exact('foo'), presuf('', 'o'));
		assertPresuf(value, '', 'o');

		value = ne.join(exact('foo'), presuf('fee', 'bo'));
		assertPresuf(value, 'f', 'o');

		value = ne.join(presuf('foo', 'bar'), presuf('foe', 'bor'));
		assertPresuf(value, 'fo', 'r');

		value = ne.join(presuf('foo', 'bar'), Top);
		assert(value.kind === 'top');
	});
});
