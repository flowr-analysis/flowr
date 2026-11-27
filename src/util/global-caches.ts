import { BoundedMap } from './collections/bounded-map';

/** What a cache that outlives a single analysis holds, deciding when it is released. */
export enum CacheScope {
	/** data of the analyzed program, useless for another one: released by every reset of an analyzer (context) */
	Analysis = 'analysis',
	/** a pure function of constant input (built-ins, config schema, databases): kept, but bounded */
	Process  = 'process'
}

interface RegisteredCache {
	readonly scope: CacheScope;
	/** the entries the cache holds, `undefined` if it cannot tell (e.g., a `WeakMap`) */
	readonly size:  () => number | undefined;
	readonly clear: () => void;
	/** the most entries the cache keeps, if it is bounded by a count */
	readonly cap?:  number;
}

/** keyed by a fixed name per cache, so registering again (e.g., a module loaded twice) replaces instead of growing */
const registry = new Map<string, RegisteredCache>();

/**
 * The module-level caches of flowR, so they can be released and inspected in one place.
 * Each cache registers once under a fixed name, {@link FlowrAnalyzerContext#reset} releases the {@link CacheScope.Analysis} ones.
 */
export const GlobalCaches = {
	/** Register a cache under `name`, by how to tell its size and how to release it. */
	register(this: void, name: string, scope: CacheScope, size: () => number | undefined, clear: () => void, cap?: number): void {
		registry.set(name, { scope, size, clear, cap });
	},
	/** A {@link BoundedMap} holding at most `cap` entries, registered under `name`. */
	map<K, V>(this: void, name: string, scope: CacheScope, cap: number): BoundedMap<K, V> {
		const map = new BoundedMap<K, V>(cap);
		GlobalCaches.register(name, scope, () => map.size, () => map.clear(), cap);
		return map;
	},
	/** Release every registered cache of the given scope. */
	clear(this: void, scope: CacheScope): void {
		for(const cache of registry.values()) {
			if(cache.scope === scope) {
				cache.clear();
			}
		}
	},
	/** The size of every registered cache by name, for tests and diagnostics. */
	sizes(this: void): Record<string, { readonly scope: CacheScope, readonly size: number | undefined, readonly cap: number | undefined }> {
		return Object.fromEntries(registry.entries().map(([name, c]) => [name, { scope: c.scope, size: c.size(), cap: c.cap }]));
	}
} as const;
