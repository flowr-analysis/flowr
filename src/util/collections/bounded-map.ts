/**
 * A map that starts over once it holds {@link cap} entries, for memos whose keys come from the analyzed code
 * and would otherwise grow with every program a long-running flowR sees.
 */
export class BoundedMap<K, V> extends Map<K, V> {
	public readonly cap: number;

	constructor(cap: number) {
		super();
		this.cap = cap;
	}

	public override set(key: K, value: V): this {
		if(this.size >= this.cap && !this.has(key)) {
			this.clear();
		}
		return super.set(key, value);
	}
}
