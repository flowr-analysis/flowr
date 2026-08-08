import { describe, test } from 'vitest';
import { assert } from 'chai';
import { ArrayQueue } from '../../../src/util/collections/queue';

describe('ArrayQueue', () => {
	test('dequeues in fifo order', () => {
		const q = new ArrayQueue([1, 2]);
		q.enqueue(3);
		assert.deepStrictEqual([q.dequeue(), q.dequeue(), q.dequeue(), q.dequeue()], [1, 2, 3, undefined]);
		assert.isTrue(q.isEmpty());
	});

	test('does not share the initial array', () => {
		const initial = [1];
		const q = new ArrayQueue(initial);
		q.enqueue(2);
		assert.deepStrictEqual(initial, [1]);
	});

	test('stays consistent across compaction', () => {
		const q = new ArrayQueue<number>();
		const n = 10_000;
		let enqueued = 0;
		for(let i = 0; i < n; i++) {
			q.enqueue(i);
			enqueued++;
		}
		for(let i = 0; i < n; i++) {
			assert.strictEqual(q.dequeue(), i);
			if(i % 100 === 0) {
				q.enqueue(n + i);
				enqueued++;
			}
			assert.strictEqual(q.size, enqueued - i - 1);
		}
		let expected = n;
		while(!q.isEmpty()) {
			assert.strictEqual(q.dequeue(), expected);
			expected += 100;
		}
		assert.isUndefined(q.dequeue());
	});
});
