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

/** one release: a parsed version paired with its release date */
export interface VersionRelease { readonly version: RVersion; readonly date: Date }

/**
 * The known releases of a blob, ascending by R-version order (empty when no dates were stored). Versions that
 * differ in writing but not in order (`1.2` and `1.2.0`) compare equal, so their dates settle them.
 */
export function releasesOf(blob: Readonly<PkgBlob> | undefined): VersionRelease[] {
	if(!blob) {
		return [];
	}
	return Object.entries(blob.dates)
		.map(([ver, day]) => ({ version: RVersion.parseOrZero(ver), date: new Date(dayToMillis(day)) }))
		.sort((a, b) => RVersion.compare(a.version.str, b.version.str) || (a.date.getTime() - b.date.getTime()));
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
	return RVersion.highest(Object.keys(blob.versions));
}

/** pick the version tuple: requested, else the package's latest, else the highest present by R-version order */
export function resolveVersion(blob: Readonly<PkgBlob>, latest: string, version?: string): string | undefined {
	if(version && blob.versions[version]) {
		return version;
	}
	if(blob.versions[latest]) {
		return latest;
	}
	return RVersion.highest(Object.keys(blob.versions));
}
