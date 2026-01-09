import { describe, test } from 'vitest';
import type { Lift } from '../../../../../src/abstract-interpretation/eval/domain';
import { Bottom, Top } from '../../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import type { ConstSet } from '../../../../../src/abstract-interpretation/eval/domains/constant-set';
import { ConstSetDomain, MAX_VARIANTS } from '../../../../../src/abstract-interpretation/eval/domains/constant-set';
import { NodeEvaluator } from './common';

function v(...value: string[]): Lift<ConstSet> {
	return {
		kind: 'const-set',
		value,
	};
}

function arreq<T>(left: T[], right: T[]): boolean {
	if(left.length !== right.length) {
		return false;
	}

	let value: T | undefined;
	while((value = left.pop()) !== undefined) {
		const index = right.findIndex(it => it === value);
		if(index === -1) {
			return false;
		} else {
			right.splice(index, 1);
		}
	}

	return true;
}

describe('String Domain: Constant Set', () => {
	const domain = ConstSetDomain;
	const ne = new NodeEvaluator(domain);

	const equalityCases: [Lift<ConstSet>, Lift<ConstSet>, boolean][] = [
		[Top, Top, true],
		[Bottom, Bottom, true],
		[Top, Bottom, false],
		[Top, v('foo'), false],
		[Bottom, v('foo'), false],
		[v('foo'), v('foo'), true],
		[v('foo'), v('bar'), false],
		[v('foo', 'bar'), v('bar', 'foo'), true],
		[v('foo', 'bar'), v('foo'), false],
	];
	test.each(equalityCases)('equality: (%j == %j) == %s', (l, r, v) => {
		assert(domain.equals(l, r) === v);
		assert(domain.equals(r, l) === v);
	});

	const sprintfCases: [Lift<ConstSet>, Lift<ConstSet>[], Lift<ConstSet>][] = [
		[Top, [], Top],
		[v('foo'), [], v('foo')],
		[v('foo', 'bar'), [], v('foo', 'bar')],
		[v('%s'), [Top], Top],
		[v('%s'), [v('bar')], v('bar')],
		[v('%s'), [v('foo', 'bar')], v('foo', 'bar')],
		[v('%s%s'), [v('foo'), v('bar')], v('foobar')],
		[v('%s%s'), [v('foo', 'FOO'), v('bar', 'BAR')], v('foobar', 'fooBAR', 'FOObar', 'FOOBAR')],
		[v('%s%s'), [v('foo'), Top], Top],
		[v('%d'), [v('5')], v('5')],
		[v('%.2f'), [v('0.33333')], v('0.33')],
		[v('%.2f', '%.3f'), [v('0.33333')], v('0.33', '0.333')],
		[v('%x', '%d'), [v('15')], v('f', '15')],
	];
	test.each(sprintfCases)('sprintf: fmt %j with args %j == %j', (fmt, args, result) => {
		const value = ne.function('sprintf', [fmt, ...args], []);
		assert(domain.equals(value, result), `was actually ${JSON.stringify(value)}`);
	});

	const elementCases: [string, Lift<ConstSet>, boolean][] = [
		['foo', Top, true],
		['foo', Bottom, false],
		['foo', v('foo'), true],
		['foo', v('foo', 'bar'), true],
		['foo', v('bar'), false],
	];
	test.each(elementCases)('%s represented by %j == %s', (string, value, expected) => {
		assert(domain.represents(string, value) === expected);
	});

	const leqCases: [Lift<ConstSet>, Lift<ConstSet>, boolean][] = [
		[Bottom, Top, true],
		[Bottom, v('foo'), true],
		[v('foo'), Top, true],
		[Bottom, v('bar'), true],
		[v('bar'), Top, true],
		[v('foo'), v('foo'), true],
		[v('foo'), v('foo', 'bar'), true],
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

		assert(value.kind === 'const-set');
		assert(value.value.length === 1);
		assert(value.value[0] === 'foobar');
	});

	test('operation: concat (single value)', () => {
		let value = ne.concat(v('sep', ','), v('foo', 'bar'));
		assert(value.kind === 'const-set');
		assert(arreq(value.value, ['foo', 'bar']));

		value = ne.concat(Top, v('foo', 'bar'));
		assert(value.kind === 'const-set');
		assert(arreq(value.value, ['foo', 'bar']));

		assert(ne.concat(v('sep', ','), Top).kind === 'top');
	});

	test('operation: concat (multiple values)', () => {
		const value = ne.concat(v('sep', ','), v('foo', 'lux'), v('bar', 'baz'));
		assert(value.kind === 'const-set');
		assert(arreq(value.value, [
			'foosepbar',
			'luxsepbar',
			'foo,bar',
			'lux,bar',
			'foosepbaz',
			'luxsepbaz',
			'foo,baz',
			'lux,baz',
		]));

		assert(ne.concat(Top, v('foo'), v('bar')).kind === 'top');
		assert(ne.concat(v('sep'), Top, v('bar')).kind === 'top');
		assert(ne.concat(v('sep'), v('foo'), Top).kind === 'top');
	});

	test('operation: join (single value)', () => {
		const value = ne.join(v('foo', 'bar'));
		assert(value.kind === 'const-set');
		assert(arreq(value.value, ['foo', 'bar']));

		assert(ne.join(Top).kind === 'top');
	});

	test('operation: join (multiple values)', () => {
		let value = ne.join(v('foo'), v('bar'));
		assert(value.kind === 'const-set');
		assert(arreq(value.value, ['foo', 'bar']));

		value = ne.join(v('foo', 'bar'), v('42', '64'));
		assert(value.kind === 'const-set');
		assert(arreq(value.value, ['foo', 'bar', '42', '64']));

		assert(ne.join(v('foo'), Top).kind === 'top');
		assert(ne.join(Top, v('foo')).kind === 'top');
		assert(ne.join(Top, Top).kind === 'top');
	});

	test('operation: join (duplicate values)', () => {
		let value = ne.join(v('foo'), v('foo'));
		assert(value.kind === 'const-set');
		assert(arreq(value.value, ['foo']));

		value = ne.join(v('foo', 'bar'), v('foo'));
		assert(value.kind === 'const-set');
		assert(arreq(value.value, ['foo', 'bar']));
	});

	test('operation: join (upper limit)', () => {
		const values: Lift<ConstSet>[] = [];
		for(let i = 0; i < MAX_VARIANTS + 1; i++) {
			values.push(v(`${i}`));
		}

		assert(ne.join(...values).kind === 'top');
	});
});

