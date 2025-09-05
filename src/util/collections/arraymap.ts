/**
 * A map type that uses an array of strings as key.
 */
export class ArrayMap<K extends string, V> {
	private readonly internal = new Map<string, V>();

	private makeKey(key: readonly K[]): string {
		return JSON.stringify(key);
	}

	/**
	 * Sets a value for a given key array.
	 */
	public set(key: readonly K[], v: V): void {
		this.internal.set(this.makeKey(key), v);
	}

	/**
	 * Return the value for the key array.
	 */
	public get(key: readonly K[]): V | undefined {
		return this.internal.get(this.makeKey(key));
	}
}
