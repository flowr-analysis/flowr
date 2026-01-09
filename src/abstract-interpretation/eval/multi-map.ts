import { throwError } from '../../util/null-or-throw';

export class MultiMap<K, V> {
	private emptySet = new Set() as ReadonlySet<V>;
	private map = new Map<K, Set<V>>();

	insert(key: K, ...value: V[]) {
		const values = this.map.get(key) ?? this.map.set(key, new Set()).get(key) ?? throwError('unreachable');
		value.forEach(v => values.add(v));
	}

	has(key: K, value: V) {
		const values = this.map.get(key);
		if(!values) {
			return false;
		} else {
			return values.has(value);
		}
	}

	get(key: K): ReadonlySet<V> {
		return this.map.get(key) ?? this.emptySet;
	}

	remove(key: K, value?: V) {
		const values = this.map.get(key);
		if(!values) {
			return [];
		}
   
		if(value) {
			values.delete(value);
			return [value];
		} else {
			this.map.delete(key);
			return values.values().toArray();
		}
	}
}
