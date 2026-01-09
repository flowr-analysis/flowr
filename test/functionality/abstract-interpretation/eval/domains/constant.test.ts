import { describe, test } from 'vitest';
import { Top } from '../../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import { ConstDomain } from '../../../../../src/abstract-interpretation/eval/domains/constant';
import { NodeEvaluator } from './common-ops';

describe('Constant String Domain', () => {
	const domain = ConstDomain;
	const ne = new NodeEvaluator(domain);
	const foo = ne.const('foo');
	const bar = ne.const('bar');
	const sep = ne.const('sep');

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
