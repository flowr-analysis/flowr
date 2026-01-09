import { describe, test } from 'vitest';
import type { Lift } from '../../../../../src/abstract-interpretation/eval/domain';
import { Top } from '../../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import type { ConstSet } from '../../../../../src/abstract-interpretation/eval/domains/constant-set';
import { ConstSetDomain, MAX_VARIANTS } from '../../../../../src/abstract-interpretation/eval/domains/constant-set';
import { NodeEvaluator } from './common-ops';

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

	while(left.length > 0) {
		const value = left.pop()!;
		const index = right.findIndex(it => it === value);
		if(index === -1) {
			return false;
		} else {
			right.splice(index, 1);
		}
	}

	return true;
}

describe('Constant Set String Domain', () => {
	const domain = ConstSetDomain;
	const ne = new NodeEvaluator(domain);

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

