import { describe, test } from 'vitest';
import type { Lift } from '../../../../../src/abstract-interpretation/eval/domain';
import { Bottom, Top } from '../../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import type { Const } from '../../../../../src/abstract-interpretation/eval/domains/constant';
import { ConstDomain } from '../../../../../src/abstract-interpretation/eval/domains/constant';
import { NodeEvaluator } from './common';

function v(value: string): Const {
	return { kind: 'const', value };
}

describe('String Domain: Constant', () => {
	const domain = ConstDomain;
	const ne = new NodeEvaluator(domain);
	const foo = v('foo');
	const bar = v('bar');
	const sep = v('sep');

	const equalityCases: [Lift<Const>, Lift<Const>, boolean][] = [
		[Top, Top, true],
		[Bottom, Bottom, true],
		[Top, Bottom, false],
		[Top, foo, false],
		[Bottom, foo, false],
		[foo, foo, true],
		[foo, sep, false],
	];
	test.each(equalityCases)('equality: (%j == %j) == %s', (l, r, v) => {
		assert(domain.equals(l, r) === v);
		assert(domain.equals(r, l) === v);
	});

	const sprintfCases: [Lift<Const>, Lift<Const>[], Lift<Const>][] = [
		[Top, [], Top],
		[v('foo'), [], v('foo')],
		[v('%s'), [Top], Top],
		[v('%s'), [v('bar')], v('bar')],
		[v('%s%s'), [v('foo'), v('bar')], v('foobar')],
		[v('%s%s'), [v('foo'), Top], Top],
		[v('%d'), [v('5')], v('5')],
		[v('%.2f'), [v('0.33333')], v('0.33')],
		[v('%x'), [v('15')], v('f')],
	];
	test.each(sprintfCases)('sprintf: fmt %j with args %j == %j', (fmt, args, result) => {
		const value = ne.function('sprintf', [fmt, ...args], []);
		assert(domain.equals(value, result), `was actually ${JSON.stringify(value)}`);
	});

	const elementCases: [string, Lift<Const>, boolean][] = [
		['foo', Top, true],
		['foo', Bottom, false],
		['foo', v('foo'), true],
		['foo', v('bar'), false],
	];
	test.each(elementCases)('%s represented by %j == %s', (string, value, expected) => {
		assert(domain.represents(string, value) === expected);
	});


	const leqCases: [Lift<Const>, Lift<Const>, boolean][] = [
		[Bottom, Top, true],
		[Bottom, v('foo'), true],
		[v('foo'), Top, true],
		[Bottom, v('bar'), true],
		[v('bar'), Top, true],
		[v('foo'), v('foo'), true],
		[v('foo'), v('bar'), false],
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
		const value = ne.const('foobar');

		assert(value.kind === 'const');
		assert(value.value === 'foobar');
	});

	test('operation: concat (single value)', () => {
		let value = ne.concat(sep, foo);
		assert(value.kind === 'const');
		assert(value.value === 'foo');

		value = ne.concat(Top, foo);
		assert(value.kind === 'const');
		assert(value.value === 'foo');

		assert(ne.concat(sep, Top).kind === 'top');
	});

	test('operation: concat (multiple values)', () => {
		const value = ne.concat(sep, foo, bar);
		assert(value.kind === 'const');
		assert(value.value === 'foosepbar');

		assert(ne.concat(Top, foo, bar).kind === 'top');
		assert(ne.concat(sep, Top, bar).kind === 'top');
		assert(ne.concat(sep, foo, Top).kind === 'top');
	});

	test('operation: join (single value)', () => {
		const value = ne.join(foo);
		assert(value.kind === 'const');
		assert(value.value === 'foo');

		assert(ne.join(Top).kind === 'top');
	});

	test('operation: join (multiple values)', () => {
		const value = ne.join(foo, foo);
		assert(value.kind === 'const');
		assert(value.value === 'foo');

		assert(ne.join(foo, bar).kind === 'top');
		assert(ne.join(foo, Top).kind === 'top');
		assert(ne.join(Top, foo).kind === 'top');
		assert(ne.join(Top, Top).kind === 'top');
	});
});
