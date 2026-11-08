import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

/** What a state needs to know of its entries: whether one is Bottom. */
interface MaybeBottom {
	isBottom(): boolean
}

/** The part of a {@link StateMap} the forks of a map share and never change. */
interface Shared<V> {
	readonly entries: ReadonlyMap<NodeId, V>
	/** the number of Bottom entries */
	readonly bottoms: number
}

/** The mapping of a state, forked in time proportional to what changed since its entries were last laid out in one map rather than to its size. */
export class StateMap<V extends MaybeBottom> implements ReadonlyMap<NodeId, V> {
	private shared:      Shared<V>;
	private changed?:    Map<NodeId, V>;
	private removed?:    Set<NodeId>;
	/** the keys the shared map does not have (or has, but removed), which come after it */
	private added?:      Map<NodeId, V>;
	private bottomCount: number;

	private constructor(shared: Shared<V>, bottoms: number) {
		this.shared = shared;
		this.bottomCount = bottoms;
	}

	/** A map of the given entries, which it copies. */
	public static of<V extends MaybeBottom>(entries: Iterable<readonly [NodeId, V]>): StateMap<V> {
		return StateMap.adopt(new Map(entries));
	}

	/** A map of the given entries, which it takes over: they must not be changed afterward. */
	public static adopt<V extends MaybeBottom>(entries: ReadonlyMap<NodeId, V>): StateMap<V> {
		let bottoms = 0;
		for(const value of entries.values()) {
			if(value.isBottom()) {
				bottoms++;
			}
		}
		return new StateMap({ entries, bottoms }, bottoms);
	}

	/** The number of entries that are Bottom. */
	public get bottoms(): number {
		return this.bottomCount;
	}

	/** An independent copy, which shares what it can with this one. */
	public fork(): StateMap<V> {
		if(this.changes() * this.changes() > 2 * this.shared.entries.size + 256) {
			this.compact();
		}
		const fork = new StateMap(this.shared, this.bottomCount);
		fork.changed = this.changed && new Map(this.changed);
		fork.removed = this.removed && new Set(this.removed);
		fork.added = this.added && new Map(this.added);
		return fork;
	}

	/** Whether both lay over the same shared map, so a key neither changed holds the very same value in both. */
	public sharesWith(other: StateMap<V>): boolean {
		return this.shared === other.shared;
	}

	/** The keys this map changed relative to the map it shares. */
	public *changedKeys(): Generator<NodeId> {
		yield* this.changed?.keys() ?? [];
		yield* this.removed ?? [];
		yield* this.added?.keys() ?? [];
	}

	/** This map with the entries of `other` written into it, `op` combining the values of a key both have, in the order of a `Map` copied from this one. */
	public union(other: StateMap<V>, op: (a: V, b: V) => V): StateMap<V> {
		const keys = this.sharesWith(other) && this.removed === undefined ? new Set([...this.changedKeys(), ...other.changedKeys()]) : other.keys();
		const result = this.fork();
		for(const key of keys) {
			const mine = this.get(key);
			const theirs = other.get(key);
			if(theirs !== undefined && mine !== theirs) {
				result.set(key, mine === undefined ? theirs : op(mine, theirs));
			}
		}
		return result;
	}

	private changes(): number {
		return (this.changed?.size ?? 0) + (this.removed?.size ?? 0) + (this.added?.size ?? 0);
	}

	/** Lays the entries out in one map of their own, which is invisible from the outside. */
	private compact(): void {
		this.shared = { entries: new Map(this.entries()), bottoms: this.bottomCount };
		this.changed = undefined;
		this.removed = undefined;
		this.added = undefined;
	}

	public get size(): number {
		return this.shared.entries.size - (this.removed?.size ?? 0) + (this.added?.size ?? 0);
	}

	public get(key: NodeId): V | undefined {
		const added = this.added?.get(key);
		if(added !== undefined || this.removed?.has(key)) {
			return added;
		}
		return this.changed?.get(key) ?? this.shared.entries.get(key);
	}

	public has(key: NodeId): boolean {
		return this.added?.has(key) === true || (this.removed?.has(key) !== true && this.shared.entries.has(key));
	}

	public set(key: NodeId, value: V): this {
		const old = this.get(key);
		this.bottomCount += (value.isBottom() ? 1 : 0) - (old?.isBottom() ? 1 : 0);
		if(this.removed?.has(key) || !this.shared.entries.has(key)) {
			(this.added ??= new Map()).set(key, value);
		} else {
			(this.changed ??= new Map()).set(key, value);
		}
		return this;
	}

	public delete(key: NodeId): boolean {
		const old = this.get(key);
		if(old === undefined && !this.has(key)) {
			return false;
		}
		if(old?.isBottom()) {
			this.bottomCount--;
		}
		if(this.added?.delete(key) !== true) {
			this.changed?.delete(key);
			(this.removed ??= new Set()).add(key);
		}
		return true;
	}

	public *entries(): MapIterator<[NodeId, V]> {
		const { changed, removed, added } = this;
		for(const [key, value] of this.shared.entries) {
			if(removed?.has(key) !== true) {
				yield [key, changed?.get(key) ?? value];
			}
		}
		if(added !== undefined) {
			yield* added;
		}
	}

	public *keys(): MapIterator<NodeId> {
		for(const [key] of this.entries()) {
			yield key;
		}
	}

	public *values(): MapIterator<V> {
		for(const [, value] of this.entries()) {
			yield value;
		}
	}

	public [Symbol.iterator](): MapIterator<[NodeId, V]> {
		return this.entries();
	}

	public forEach(callback: (value: V, key: NodeId, map: ReadonlyMap<NodeId, V>) => void, thisArg?: unknown): void {
		for(const [key, value] of this.entries()) {
			callback.call(thisArg, value, key, this);
		}
	}
}
