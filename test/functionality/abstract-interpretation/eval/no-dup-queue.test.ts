import { assert, describe, test } from 'vitest';
import { NoDupQueue } from '../../../../src/abstract-interpretation/eval/no-dup-queue';

describe('dbe: NoDupQueue', () => {
	test('emptiness', () => {
		const q = new NoDupQueue();
		assert(q.isEmpty());
		q.push(0);
		assert(!q.isEmpty());
		assert(q.pop() !== undefined);
		assert(q.isEmpty());
		assert(q.pop() === undefined);
	});

	test('element order', () => {
		const q = new NoDupQueue();
		q.push(1);
		q.push(2);

		assert(q.pop() === 1);
		assert(q.pop() === 2);
	});

	test('push-pop', () => {
		const q = new NoDupQueue();
		q.push(1);
		assert(q.pop() === 1);

		q.push(1);
		q.push(2);
		q.push(3);
		assert(q.pop() === 1);
		assert(q.pop() === 2);
		assert(q.pop() === 3);
	});

	test('initial values', () => {
		const q = new NoDupQueue();
		assert(q.isEmpty());

		const q2 = new NoDupQueue(1, 2);
		assert(q2.pop() === 1);
		assert(q2.pop() === 2);
		assert(q2.isEmpty());
	});

	test('duplicate values', () => {
		const q = new NoDupQueue();
		q.push(1, 2, 1);
		assert(q.pop() === 1);
		assert(q.pop() === 2);
		assert(q.isEmpty());
	});
});
