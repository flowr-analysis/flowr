/**
 * A map type that accepts an arbitrary object as key.
 * {@link JSON.stringify} is used to create the actual key for the underlying map.
 * This can be helpful if value equality is desired.
 */
export class ObjectMap<K, V> {
	private readonly internal = new Map<string, V>();

	private makeKey(key: K): string {
		return JSON.stringify(key);
	}

	/**
	 * Sets a value for a given key.
	 */
	public set(key: K, v: V): void {
		this.internal.set(this.makeKey(key), v);
	}

	/**
	 * Return the value for the key.
	 */
	public get(key: K): V | undefined {
		return this.internal.get(this.makeKey(key));
	}
}
