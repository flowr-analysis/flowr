import { unionOfSets } from './fixpoint';

/** Values that combine: `concat` is associative and `empty` changes nothing. */
export interface Monoid<T> {
	readonly empty:      T
	readonly concat:     (a: T, b: T) => T
	/** combines many values at once, where that is cheaper than combining them one by one */
	readonly concatAll?: (values: readonly T[]) => T
}

/**
 * Helper functions for {@link Monoid}s.
 * @example
 * ```ts
 * Monoid.foldMap(Monoid.any, [1, 2], n => n > 1); // true
 * ```
 * @helper values
 */
export const Monoid = {
	name: 'Monoid',
	/** Combines all values, `empty` if there are none. */
	fold<T>(this: void, monoid: Monoid<T>, values: Iterable<T>): T {
		const all = [...values];
		return monoid.concatAll?.(all) ?? all.reduce((a, b) => monoid.concat(a, b), monoid.empty);
	},
	/** Combines what `f` makes of each item, `empty` if there are none. */
	foldMap<A, T>(this: void, monoid: Monoid<T>, items: Iterable<A>, f: (item: A) => T): T {
		return Monoid.fold(monoid, Iterator.from(items).map(f).toArray());
	},
	/** Whether any value holds. */
	any: { empty: false, concat: (a: boolean, b: boolean) => a || b } as Monoid<boolean>,
	/** The union of sets, which shares a set wherever it holds the other, see {@link unionOfSets}. */
	set<T>(this: void): Monoid<ReadonlySet<T>> {
		return { empty: new Set<T>(), concat: unionOfSets };
	}
} as const;
