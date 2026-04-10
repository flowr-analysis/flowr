/**
 * Helper for transforming records.
 */
export const Record = {
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
	values<V>(this: void, object: Partial<Record<string, V>>): V[] {
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
	 * Transforms a record by applying a callback function to each key-value pair in the record.
	 * @param object - The record that should be transformed.
	 * @param callbackfn - The callback function that transforms each key-value pair of the record.
	 */
	map<K1 extends string, K2 extends string, V1, V2>(this: void, object: Record<K1, V1>, callbackfn: (entry: [K1, V1], index: number, entries: [K1, V1][]) => [K2, V2]): Record<K2, V2> {
		return Object.fromEntries(
			Record.entries<K1, V1>(object).map(callbackfn)
		) as Record<K2, V2>;
	},
	/**
	 * Transforms a record by applying a callback function to each key in the record.
	 * @param object - The record that should be transformed.
	 * @param callbackfn - The callback function that transforms each key of the record.
	 */
	mapKeys<K1 extends string, K2 extends string, V>(this: void, object: Record<K1, V>, callbackfn: (key: K1, index: number, entries: [K1, V][]) => K2): Record<K2, V> {
		return Record.map(object, ([key, value], index, entries) => [callbackfn(key, index, entries), value]);
	},
	/**
	 * Transforms a record by applying a callback function to each property value in the record.
	 * @param object - The record that should be transformed.
	 * @param callbackfn - The callback function that transforms each property value of the record.
	 */
	mapProperties<K extends string, V1, V2>(this: void, object: Record<K, V1>, callbackfn: (value: V1, index: number, entries: [K, V1][]) => V2): Record<K, V2> {
		return Record.map(object, ([keys, value], index, entries) => [keys, callbackfn(value, index, entries)]);
	}
};
