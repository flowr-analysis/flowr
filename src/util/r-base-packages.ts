import { RBasePackageStore } from '../data/r-base-packages.generated';
import { RVersion } from './r-version';

/**
 * The R-core / base packages -- those that ship with R and are attached on the search path without an
 * explicit `library()` (`base`, `stats`, `graphics`, `utils`, `Reduce`/`arima`/`outer` live here). This
 * knowledge is NOT hardcoded: it is read from a store recomputed from the signature database whenever flowR
 * is bundled (see `scripts/gen-base-packages.ts`), so it stays in sync with the database (its single source
 * of truth, hence the `current-base` shard) and needs no maintenance.
 */

/** clamp `rVersion` to the newest R release the store knows about (so a future R version stays answerable) */
function effective(rVersion: string): string {
	return RVersion.compare(rVersion, RBasePackageStore.newestRVersion) > 0 ? RBasePackageStore.newestRVersion : rVersion;
}

/** memoized results per assumed R version, so the list is computed at most once per version (never per lookup) */
const cache = new Map<string, readonly string[]>();

/**
 * The base packages available at the assumed R version (all of them if omitted). A package counts as
 * available when that R release lies within the range it was part of core; e.g. `parallel` (added in R
 * 2.14.0) is absent for an assumed R 2.10, and long-merged packages like `ctest` are absent for modern R.
 *
 * The newest release is served from the precomputed {@link RBasePackageStore.current} array in O(1); every
 * other version is computed once and memoized, so this never recomputes on repeated calls.
 */
export function baseRPackages(rVersion?: string): readonly string[] {
	// fast path: no version, or the exact newest-release string, avoids the (regex-based) version compare entirely
	if(rVersion === undefined || rVersion === RBasePackageStore.newestRVersion || RVersion.compare(rVersion, RBasePackageStore.newestRVersion) >= 0) {
		return RBasePackageStore.current;   // the current base set, precomputed at bundle time
	}
	const cached = cache.get(rVersion);
	if(cached !== undefined) {
		return cached;
	}
	const eff = effective(rVersion);
	const result = Object.entries(RBasePackageStore.packages)
		.filter(([, [first, last]]) => RVersion.compare(first, eff) <= 0 && RVersion.compare(last, eff) >= 0)
		.map(([name]) => name);
	cache.set(rVersion, result);
	return result;
}

/** the base export to owning-package map, materialised once from the grouped store (never per lookup) */
let exportOwners: Map<string, string> | undefined;

/**
 * The base-R package that exports `name` (e.g. `sd` yields `stats`, `plot` yields `base`), or `undefined`.
 * Backed by the bundle-time store, so it needs no loaded database and no runtime resolution: the
 * export-to-package index is inverted from {@link RBasePackageStore.exportsByPackage} once on first use.
 */
export function baseRExportOwner(name: string): string | undefined {
	if(exportOwners === undefined) {
		exportOwners = new Map();
		for(const [pkg, names] of Object.entries(RBasePackageStore.exportsByPackage)) {
			for(const exported of names) {
				exportOwners.set(exported, pkg);
			}
		}
	}
	return exportOwners.get(name);
}

/** whether `name` is an R-core / base package at the assumed R version (see {@link baseRPackages}). */
export function isBaseRPackage(name: string, rVersion?: string): boolean {
	// the store is `as const`, so it carries no string index signature; read it as a record for the dynamic lookup
	const range = (RBasePackageStore.packages as Record<string, readonly [first: string, last: string] | undefined>)[name];
	if(range === undefined) {
		return false;
	}
	if(rVersion === undefined) {
		return true;
	}
	const eff = effective(rVersion);
	return RVersion.compare(range[0], eff) <= 0 && RVersion.compare(range[1], eff) >= 0;
}
