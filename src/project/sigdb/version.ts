/**
 * Version/date resolution over a {@link PkgBlob}: parsing stored version strings into comparable
 * {@link RVersion}s, decoding the day-granularity release dates, and picking the effective version for a query.
 * Split out of `../sigdb` so the reader/writer there stays focused on the byte format.
 */
import { RVersion } from '../../util/r-version';
import type { PkgBlob } from './schema';

/** milliseconds since the Unix epoch for a stored day count (dates are stored at day granularity to save space) */
export function dayToMillis(day: number): number {
	return day * 86_400_000;
}

/**
 * Parse a stored version string into an {@link RVersion}; never throws -- a truly un-coercible version sorts
 * as `0.0.0` but keeps its original `.str`.
 */
export function toRVersion(version: string): RVersion {
	const parsed = RVersion.parse(version);
	if(parsed !== undefined) {
		return parsed;
	}
	const fallback = RVersion.parse('0.0.0') as RVersion;   // `0.0.0` always parses
	fallback.str = version;
	return fallback;
}

/** one release: a parsed version paired with its release date */
export interface VersionRelease { readonly version: RVersion; readonly date: Date }

/** the known releases of a blob, ascending by R-version order (empty when no dates were stored) */
export function releasesOf(blob: Readonly<PkgBlob> | undefined): VersionRelease[] {
	if(!blob) {
		return [];
	}
	return Object.entries(blob.dates)
		.map(([ver, day]) => ({ version: toRVersion(ver), date: new Date(dayToMillis(day)) }))
		.sort((a, b) => RVersion.compare(a.version.str, b.version.str));
}

/** the highest of some version strings by R's `numeric_version` order (`0.9.0 < 0.10.0`); undefined if none */
export function highestVersion(versions: Iterable<string>): string | undefined {
	let best: string | undefined;
	for(const v of versions) {
		if(best === undefined || RVersion.compare(v, best) > 0) {
			best = v;
		}
	}
	return best;
}

/** the version with the newest release date (falling back to `latest`, then the highest by R-version order) */
export function newestVersion(blob: Readonly<PkgBlob>, latest: string): string | undefined {
	let best: string | undefined;
	let bestDay = -Infinity;
	for(const [ver, day] of Object.entries(blob.dates)) {
		if(day > bestDay) {
			bestDay = day;
			best = ver;
		}
	}
	if(best !== undefined) {
		return best;
	}
	if(blob.versions[latest]) {
		return latest;
	}
	// no dates and no recorded latest: pick the highest by R's numeric-version order (not string order)
	return highestVersion(Object.keys(blob.versions));
}

/** pick the version tuple: requested, else the package's latest, else the highest present by R-version order */
export function resolveVersion(blob: Readonly<PkgBlob>, latest: string, version?: string): string | undefined {
	if(version && blob.versions[version]) {
		return version;
	}
	if(blob.versions[latest]) {
		return latest;
	}
	return highestVersion(Object.keys(blob.versions));
}
