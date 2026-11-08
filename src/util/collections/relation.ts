import type { Monoid } from '../monoid';

/** Which values each key relates to, like the calls accessing a part of the global state. No key relates to an empty set. */
export type Relation<K, V> = ReadonlyMap<K, ReadonlySet<V>>;

const Empty = new Map<never, never>();

/**
 * Helper functions for the {@link Relation}, which never change a given relation and share its sets, so do not change them either.
 * @example
 * ```ts
 * Relation.fromPairs([['x', 1], ['x', 2]]); // x relates to 1 and 2
 * ```
 */
export const Relation = {
	name: 'Relation',
	empty<K, V>(this: void): Relation<K, V> {
		return Empty;
	},
	/** Relates every key to `values`, which all of them share. */
	of<K, V>(this: void, keys: readonly K[], values: ReadonlySet<V>): Relation<K, V> {
		return keys.length === 0 ? Relation.empty() : new Map(keys.map(key => [key, values]));
	},
	fromPairs<K, V>(this: void, pairs: Iterable<readonly [K, V]>): Relation<K, V> {
		const relation = new Map<K, Set<V>>();
		for(const [key, value] of pairs) {
			const known = relation.get(key);
			if(known === undefined) {
				relation.set(key, new Set([value]));
			} else {
				known.add(value);
			}
		}
		return relation;
	},
	/** All pairs of all relations, in one pass, and the relation itself if it is the only one holding any. */
	unionAll<K, V>(this: void, relations: readonly Relation<K, V>[]): Relation<K, V> {
		const given = relations.filter(r => r.size > 0);
		if(given.length <= 1) {
			return given[0] ?? Relation.empty();
		}
		const union = new Map<K, Set<V>>();
		for(const relation of given) {
			for(const [key, values] of relation) {
				const known = union.get(key);
				if(known === undefined) {
					union.set(key, new Set(values));
				} else {
					values.forEach(value => known.add(value));
				}
			}
		}
		return union;
	},
	/** The relation without the keys `other` holds, itself if there are none. */
	withoutKeysOf<K, V>(this: void, relation: Relation<K, V>, other: Relation<K, unknown>): Relation<K, V> {
		return relation.keys().some(key => other.has(key)) ? new Map(relation.entries().filter(([key]) => !other.has(key))) : relation;
	},
	monoid<K, V>(this: void): Monoid<Relation<K, V>> {
		return { empty: Relation.empty(), concat: (a, b) => Relation.unionAll([a, b]), concatAll: Relation.unionAll };
	}
} as const;
