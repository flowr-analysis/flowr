import { addExtension } from 'msgpackr';

/**
 * When to fill the value -&gt; key direction of a {@link BiMap}.
 *
 * - `lazy` (default) fills it on the first reverse lookup and maintains it from then on, so a map nobody asks in
 *   reverse never pays a write per entry.
 * - `eager` fills it from the start, for a map written once and then asked in reverse from a hot path.
 *
 * Both answer {@link BiMap#getKey|getKey} and {@link BiMap#hasValue|hasValue} the same, they differ only in when
 * the work happens.
 */
export type BiMapReverse = 'lazy' | 'eager';

/**
 * Implementation of a bidirectional map
 *
 * All map-related functions are based on the normal Key -&gt; Value map
 */
export class BiMap<K, V extends object> implements Map<K, V> {
	public readonly [Symbol.toStringTag]: string = 'BiMap';
	public size = 0;
	private readonly k2v = new Map<K, V>();
	/* see {@link BiMapReverse}: `undefined` until the first reverse lookup unless this map was asked to be eager */
	private v2k:                          WeakMap<V, K> | undefined;
	private readonly eager:               boolean;

	/**
	 * @param base    - the entries to fill the map with
	 * @param reverse - when to fill the value -&gt; key direction; see {@link BiMapReverse}
	 */
	constructor(base?: Iterable<[K, V]>, reverse: BiMapReverse = 'lazy') {
		this.eager = reverse === 'eager';
		if(this.eager) {
			this.v2k = new WeakMap<V, K>();
		}
		if(base != null) {
			for(const [k, v] of base) {
				this.set(k, v);
			}
		}
	}

	public [Symbol.iterator](): MapIterator<[K, V]> {
		return this.k2v[Symbol.iterator]();
	}

	public clear(): void {
		this.size = 0;
		this.k2v.clear();
		this.v2k = this.eager ? new WeakMap<V, K>() : undefined;
	}

	public delete(key: K): boolean {
		const value = this.k2v.get(key);
		if(value === undefined) {
			return false;
		}
		this.k2v.delete(key);
		/* another key may still hold this value, so dropping just its entry would lose a live mapping */
		this.staleReverse();
		this.size = this.k2v.size;
		return true;
	}

	public entries(): MapIterator<[K, V]> {
		return this.k2v.entries();
	}

	public forEach(callbackFunction: (value: V, key: K, map: Map<K, V>) => void): void {
		this.k2v.forEach(callbackFunction);
	}

	public get(key: K): V | undefined {
		return this.k2v.get(key);
	}

	public getKey(value: V): K | undefined {
		return this.reverse().get(value);
	}

	public has(key: K): boolean {
		return this.k2v.has(key);
	}

	public hasValue(value: V): boolean {
		return this.reverse().has(value);
	}

	public keys(): MapIterator<K> {
		return this.k2v.keys();
	}

	public set(key: K, value: V): this {
		const replaced = this.k2v.get(key);
		this.k2v.set(key, value);
		if(replaced !== undefined && replaced !== value) {
			/* the value this key held may now be unreachable, so its reverse entry cannot stand */
			this.staleReverse();
		} else {
			this.v2k?.set(value, key);
		}
		this.size = this.k2v.size;
		return this;
	}

	/** the reverse direction can no longer be maintained in place, so re-derive it (at once if eager) */
	private staleReverse(): void {
		this.v2k = undefined;
		if(this.eager) {
			this.reverse();
		}
	}

	public values(): MapIterator<V> {
		return this.k2v.values();
	}

	/** the value -&gt; key direction, filled from the entries already present if this is its first use */
	private reverse(): WeakMap<V, K> {
		if(this.v2k === undefined) {
			const v2k = new WeakMap<V, K>();
			for(const [k, v] of this.k2v) {
				v2k.set(v, k);
			}
			this.v2k = v2k;
		}
		return this.v2k;
	}
}

addExtension({
	Class: BiMap,
	type:  3,
	write: (instance: BiMap<unknown, object>) => Array.from(instance.entries()),
	read:  (data: [unknown, object][]) => new BiMap(data)
});
