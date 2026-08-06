/**
 * Helper for transforming records.
 */
export const Record = {
	/**
	 * Checks whether a key is a property of a record.
	 * @param object - The record to check the key for.
	 * @param key    - The ley to check for.
	 */
	has<K extends string>(this: void, object: Partial<Record<K, unknown>>, key: string): key is K {
		return Object.hasOwn(object, key);
	},
	/**
	 * Returns an array of the names of the properties of a record.
	 * @param object - The record to get the property names from.
	 */
	keys<K extends string>(this: void, object: Partial<Record<K, unknown>>): K[] {
		return Object.keys(object) as K[];
	},
	/**
	 * Returns an array of the values of the properties of a record.
	 * @param object - The record to get the property values from.
	 */
	values<K extends string, V>(this: void, object: Partial<Record<K, V>>): V[] {
		return Object.values(object) as V[];
	},
	/**
	 * Returns an array of the key-value pairs of the properties of a record.
	 * @param object - The record to get the properties from.
	 */
	entries<K extends string, V>(this: void, object: Partial<Record<K, V>>): [K, V][] {
		return Object.entries(object) as [K, V][];
	},
	/**
	 * Returns an array of the key-value pairs of the properties of a record.
	 * @param object - The record to get the properties from.
	 */
	properties<K extends string, V, O extends Partial<Record<K, V>>>(this: void, object: O): [keyof O, O[keyof O]][] {
		return Object.entries(object) as [keyof O, O[keyof O]][];
	},
	/**
	 * Transforms a record by applying a callback function to each key-value pair in the record.
	 * @param object - The record that should be transformed.
	 * @param callbackfn - The callback function that transforms each key-value pair of the record.
	 * @see {@link Record.mapPartial} for a version that works with partial records.
	 */
	map<K1 extends string, K2 extends string, V1, V2>(this: void, object: Record<K1, V1>, callbackfn: (entry: [K1, V1], index: number, entries: [K1, V1][]) => [K2, V2]): Record<K2, V2> {
		return Object.fromEntries(
			Record.entries<K1, V1>(object).map(callbackfn)
		) as Record<K2, V2>;
	},
	/**
	 * Transforms a partial record by applying a callback function to each key-value pair in the record.
	 * @param object - The record that should be transformed.
	 * @param callbackfn - The callback function that transforms each key-value pair of the record.
	 * @see {@link Record.map} for a version that works with required records.
	 */
	mapPartial<K1 extends string, K2 extends string, V1, V2>(this: void, object: Partial<Record<K1, V1>>, callbackfn: (entry: [K1, V1], index: number, entries: [K1, V1][]) => [K2, V2]): Partial<Record<K2, V2>> {
		return Object.fromEntries(
			Record.entries<K1, V1>(object)
				.filter((value): value is [K1, Record<K1, V1>[K1]] => value[1] !== undefined)
				.map(callbackfn)
		) as Partial<Record<K2, V2>>;
	},
	/**
	 * Transforms a record by applying a callback function to each key in the record.
	 * @param object - The record that should be transformed.
	 * @param callbackfn - The callback function that transforms each key of the record.
	 * @see {@link Record.mapPartialKeys} for a version that works with partial records.
	 */
	mapKeys<K1 extends string, K2 extends string, V>(this: void, object: Record<K1, V>, callbackfn: (key: K1, index: number, entries: [K1, V][]) => K2): Record<K2, V> {
		return Record.map(object, ([key, value], index, entries) => [callbackfn(key, index, entries), value]);
	},
	/**
	 * Transforms a partial record by applying a callback function to each key in the record.
	 * @param object - The record that should be transformed.
	 * @param callbackfn - The callback function that transforms each key of the record.
	 * @see {@link Record.mapKeys} for a version that works with required records.
	 */
	mapPartialKeys<K1 extends string, K2 extends string, V>(this: void, object: Partial<Record<K1, V>>, callbackfn: (key: K1, index: number, entries: [K1, V][]) => K2): Partial<Record<K2, V>> {
		return Record.mapPartial(object, ([key, value], index, entries) => [callbackfn(key, index, entries), value]);
	},
	/**
	 * Transforms a record by applying a callback function to each property value in the record.
	 * @param object - The record that should be transformed.
	 * @param callbackfn - The callback function that transforms each property value of the record.
	 * @see {@link Record.mapPartialProps} for a version that works with partial records.
	 */
	mapProps<K extends string, V1, V2>(this: void, object: Record<K, V1>, callbackfn: (value: V1, index: number, entries: [K, V1][]) => V2): Record<K, V2> {
		return Record.map(object, ([keys, value], index, entries) => [keys, callbackfn(value, index, entries)]);
	},
	/**
	 * Transforms a partial record by applying a callback function to each property value in the record.
	 * @param object - The record that should be transformed.
	 * @param callbackfn - The callback function that transforms each property value of the record.
	 * @see {@link Record.mapProps} for a version that works with required records.
	 */
	mapPartialProps<K extends string, V1, V2>(this: void, object: Partial<Record<K, V1>>, callbackfn: (value: V1, index: number, entries: [K, V1][]) => V2): Partial<Record<K, V2>> {
		return Record.mapPartial(object, ([keys, value], index, entries) => [keys, callbackfn(value, index, entries)]);
	}
} as const;
