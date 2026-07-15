/**
 * A FIFO queue over a growable array with amortized O(1) dequeue.
 * Entries are consumed via an index (instead of costly `Array#shift` calls),
 * and the consumed prefix is dropped once it dominates the array,
 * bounding the memory overhead to twice the live queue size.
 */
export class ArrayQueue<T> {
	private elements: T[];
	private idx = 0;

	constructor(initial?: readonly T[]) {
		this.elements = initial ? initial.slice() : [];
	}

	public enqueue(item: T): void {
		this.elements.push(item);
	}

	/** Returns the oldest element, or `undefined` if the queue {@link isEmpty}. */
	public dequeue(): T | undefined {
		if(this.idx >= this.elements.length) {
			return undefined;
		}
		if(this.idx > 1024 && this.idx * 2 > this.elements.length) {
			this.elements = this.elements.slice(this.idx);
			this.idx = 0;
		}
		return this.elements[this.idx++];
	}

	public get size(): number {
		return this.elements.length - this.idx;
	}

	public isEmpty(): boolean {
		return this.idx >= this.elements.length;
	}
}
