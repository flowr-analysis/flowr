import { bench } from 'vitest';
import { ArrayQueue } from '../../../src/util/collections/queue';

/* enqueue two elements per dequeue so the queue grows large, as in graph traversals with many edges */
const N = 20_000;

bench('ArrayQueue (index with compaction)', () => {
	const q = new ArrayQueue([0]);
	let produced = 1;
	while(!q.isEmpty()) {
		q.dequeue();
		for(let i = 0; i < 2 && produced < N; i++) {
			q.enqueue(produced++);
		}
	}
});

bench('plain array with shift', () => {
	const q = [0];
	let produced = 1;
	while(q.length > 0) {
		q.shift();
		for(let i = 0; i < 2 && produced < N; i++) {
			q.push(produced++);
		}
	}
});
