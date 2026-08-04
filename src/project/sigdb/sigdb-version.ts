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

/** the inclusive millisecond window spanned by a `YYYY`, `YYYY.MM`, or `YYYY.MM.DD` date spec */
export interface DateWindow { readonly lower: number; readonly upper: number }

const DatePartsRegex = /^((?:19|20)\d{2})(?:\.(\d{1,2}))?(?:\.(\d{1,2}))?$/;
/** the comparators + `YYYY.MM.DD` date a release-date bound may use (a comparator disambiguates from a calendar version) */
const DateBoundRegex = /^(<=|>=|<|>|=)\s*((?:19|20)\d{2}(?:\.\d{1,2}){0,2})$/;

/**
 * Parse a `YYYY`, `YYYY.MM`, or `YYYY.MM.DD` spec into its inclusive `[lower, upper]` millisecond window (the whole
 * year / month / day named), or `undefined` when malformed or out of range (month `1..12`, day `1..31`).
 */
export function parseDateWindow(spec: string): DateWindow | undefined {
	const m = DatePartsRegex.exec(spec.trim());
	if(!m) {
		return undefined;
	}
	const year = Number(m[1]);
	const month = m[2] !== undefined ? Number(m[2]) : undefined;
	const day = m[3] !== undefined ? Number(m[3]) : undefined;
	// reject impossible month/day rather than letting Date.UTC silently roll over (`2021.13` -> Jan 2022)
	if((month !== undefined && (month < 1 || month > 12)) || (day !== undefined && (day < 1 || day > 31))) {
		return undefined;
	}
	const lower = Date.UTC(year, (month ?? 1) - 1, day ?? 1);
	const upper = day !== undefined ? lower + 86_400_000 - 1
		: month !== undefined ? Date.UTC(year, month, 1) - 1
			: Date.UTC(year + 1, 0, 1) - 1;
	return { lower, upper };
}

/** whether `spec` is a release-date bound like `<=2026` or `>=2021.05` (a comparator is required) */
export function isDateBound(spec: string): boolean {
	return DateBoundRegex.test(spec.trim());
}

/**
 * A release-date predicate for a bound like `<=2026`, `>=2021.05.03` (`YYYY.MM.DD`, comparator required), or
 * `undefined` when `spec` is not a date bound. An undated release (or an impossible date) never matches.
 */
export function releaseDateBound(spec: string): ((date: Date | undefined) => boolean) | undefined {
	const m = DateBoundRegex.exec(spec.trim());
	if(!m) {
		return undefined;
	}
	const cmp = m[1];
	const window = parseDateWindow(m[2]);
	if(!window) {
		return () => false; // a valid comparator but an impossible date matches nothing
	}
	const { lower, upper } = window;
	return date => {
		if(date === undefined) {
			return false;
		}
		const t = date.getTime();
		switch(cmp) {
			case '<=': return t <= upper;
			case '<':  return t < lower;
			case '>=': return t >= lower;
			case '>':  return t > upper;
			default:   return t >= lower && t <= upper;
		}
	};
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
