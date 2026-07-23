import { coerce, Range, SemVer, satisfies as semverSatisfies } from 'semver';


function makeVersion(version: string, original: string) {
	const semver = new SemVer(version) as SemVer & { str: string };
	semver.str = original;
	return semver;
}

function tryNormalizeNumberPart(part: string): string {
	try {
		const res = Number(part);
		if(!Number.isNaN(res)) {
			return String(res);
		}
	} catch{
		return part;
	}
	return part;
}
function normalizeVersion(version: string): string {
	version = version.trim();
	let comparator = '';
	// extract comparator if present
	const comparatorMatch = version.match(/^([<>=~^]+)/);
	if(comparatorMatch) {
		comparator = comparatorMatch[1].replace('==', '=');
		version = version.slice(comparatorMatch[1].length).trim();
	}
	// R separates version components by `.` or `-` alike (`7.3-65` is `7.3.65`, and above `7.3.0`), so a numeric
	// part is a component wherever it stands; only a non-numeric tail is a SemVer pre-release
	const parts = version.split(/[.-]/).filter(p => p.length > 0);
	let numeric = 0;
	while(numeric < parts.length && /^\d+$/.test(parts[numeric])) {
		numeric++;
	}
	const mainVersionParts = parts.slice(0, numeric);
	const preReleaseParts = parts.slice(numeric);
	if(mainVersionParts.length > 3) {
		const newPreReleasePart = mainVersionParts.splice(3).join('.');
		preReleaseParts.unshift(newPreReleasePart);
	} else {
		while(mainVersionParts.length < 3) {
			mainVersionParts.push('0');
		}
	}
	let prerelease = '';
	if(preReleaseParts.length > 0) {
		prerelease = '-' + preReleaseParts.join('-').split('.').map(part => tryNormalizeNumberPart(part)).join('.');
	}
	return comparator + mainVersionParts.map(tryNormalizeNumberPart).join('.') + prerelease;
}



const AnyVerWithMaybeRangeRegex = /(\s*[<>=~^]*\s*\d+(\.\d*)*(-[0-9A-Za-z-.]+)?)/g;
function normalizeVersions(versions: string): string {
	const parts: string[] = [];
	// extract all version-like parts and normalize them individually
	let match: RegExpExecArray | null;
	let index = 0;
	while((match = AnyVerWithMaybeRangeRegex.exec(versions)) !== null) {
		const prefix = versions.slice(index, match.index);
		if(prefix.length > 0) {
			parts.push(prefix);
		}
		const versionPart = match[1];
		parts.push(normalizeVersion(versionPart));
		index = match.index + versionPart.length;
	}
	if(index < versions.length) {
		parts.push(versions.slice(index));
	}
	return parts.join('');
}

function makeRange(range: string, original: string) {
	const semverRange = new Range(range) as Range & { str: string };
	semverRange.str = original;
	return semverRange;
}

/**
 * A version written as its source string (e.g. `1.5-8`, `4.3.0`), as it appears in a `DESCRIPTION`, the signature
 * database, or a bound. Distinct from a parsed {@link RVersion}: use {@link RVersion.parse}/{@link RVersion.compare}
 * to order these. An alias for `string` that documents intent -- prefer it over a bare `string` for version values.
 */
export type VersionString = string;

/** A parsed R package version: a comparable {@link SemVer} that also keeps its original string as `.str`. */
export type RVersion = SemVer & { str: string };

/** Helpers for R package versions (`1.2-3` style), which are freer than SemVer. */
export const RVersion = {
	/**
	 * Parse an R version string into a {@link SemVer}, normalizing R's freer scheme (e.g. `0.4-9`). Unlike
	 * `new SemVer(version)` this coerces where needed; the original string is available via `.str`. Returns
	 * undefined (never throws) when the string cannot be coerced to a version at all.
	 * @see {@link RVersion.parseOrZero}
	 */
	parse(this: void, version: string): RVersion | undefined {
		try {
			return makeVersion(version, version);
		} catch{ /* try to normalize */ }
		try {
			return makeVersion(normalizeVersions(version), version);
		} catch{ /* fall back to coercion */ }
		// like {@link RRange.parse}, this never throws: a truly un-coercible version (e.g. an empty `Version:`
		// field or pure text) yields undefined so the caller can detect it rather than crashing
		const coerced = coerce(version, { loose: true, includePrerelease: true });
		return coerced === null ? undefined : makeVersion(coerced.version, version);
	},

	/**
	 * Compare two R version strings following R's `numeric_version` scheme: split on `.` and `-`, compare
	 * numerically, shorter versions padded with zeros (`0.4-9 < 0.4.10 < 1.0`). Negative/zero/positive for
	 * `a` less than/equal to/greater than `b`.
	 */
	compare(this: void, a: string | undefined, b: string | undefined): number {
		// an absent version sorts below any concrete one (so ascending order puts `undefined` first, descending last)
		if(a === undefined || b === undefined) {
			return a === b ? 0 : a === undefined ? -1 : 1;
		}
		const pa = a.split(/[.-]/), pb = b.split(/[.-]/);
		for(let i = 0; i < Math.max(pa.length, pb.length); i++) {
			const x = Number(pa[i] ?? 0) || 0, y = Number(pb[i] ?? 0) || 0;
			if(x !== y) {
				return x - y;
			}
		}
		return 0;
	},

	/**
	 * Like {@link parse} but never undefined: a truly un-coercible version sorts as `0.0.0` while keeping its
	 * original string as `.str`, so it stays usable as a sort key.
	 * @see {@link RVersion.parse}
	 */
	parseOrZero(this: void, version: string): RVersion {
		const parsed = RVersion.parse(version);
		if(parsed !== undefined) {
			return parsed;
		}
		const fallback = RVersion.parse('0.0.0') as RVersion;   // `0.0.0` always parses
		fallback.str = version;
		return fallback;
	},

	/** The highest of some version strings by R's `numeric_version` order (`0.9.0 < 0.10.0`); undefined if none. */
	highest(this: void, versions: Iterable<string>): string | undefined {
		let best: string | undefined;
		for(const v of versions) {
			if(best === undefined || RVersion.compare(v, best) > 0) {
				best = v;
			}
		}
		return best;
	}
} as const;

/** release dates of R minor versions (`major.minor`); base R is stored undated in the sigdb, so this date-bounds it */
const RReleaseDates: Readonly<Record<string, string>> = {
	'4.5':  '2025-04-11', '4.4':  '2024-04-24', '4.3':  '2023-04-21', '4.2':  '2022-04-22',
	'4.1':  '2021-05-18', '4.0':  '2020-04-24', '3.6':  '2019-04-26', '3.5':  '2018-04-23',
	'3.4':  '2017-04-21', '3.3':  '2016-05-03', '3.2':  '2015-04-16', '3.1':  '2014-04-10',
	'3.0':  '2013-04-03', '2.15': '2012-03-30', '2.14': '2011-10-31', '2.13': '2011-04-13'
};

/** the release date of an R version, matched by its `major.minor`, or `undefined` for versions older than the table */
export function rReleaseDate(version: string): Date | undefined {
	const m = /^(\d+)\.(\d+)/.exec(version);
	const iso = m ? RReleaseDates[`${m[1]}.${m[2]}`] : undefined;
	return iso ? new Date(iso) : undefined;
}

/** Helpers for R package version ranges (DESCRIPTION constraints like `>= 0.4-9`). */
export const RRange = {
	/**
	 * Parse an R version range string into a {@link Range}, normalizing R's freer scheme. The original range
	 * string is available via `.str`.
	 *
	 * This never throws: an unparseable constraint (e.g. `>= abc`, or a git/URL "version" from a lockfile) yields
	 * `undefined` rather than aborting the caller, so a malformed constraint is *detectable* and simply contributes
	 * no version bound. Parsing is attempted first verbatim, then after normalizing R's scheme to SemVer.
	 */
	parse(this: void, range: string): (Range & { str: string }) | undefined {
		try {
			return makeRange(range, range);
		} catch{ /* try to normalize R range to SemVer */ }
		try {
			return makeRange(normalizeVersions(range), range);
		} catch{ /* unparseable even after normalization -> report as "no constraint" */ }
		return undefined;
	},

	/**
	 * Whether an R version string satisfies a range constraint, normalizing R's freer scheme on both sides.
	 * `range` may be a parsed {@link Range} or a raw constraint string. Returns `false` if either is unparseable
	 * (never throws), so a malformed version/constraint simply does not match.
	 */
	satisfies(this: void, version: string, range: Range | string): boolean {
		const v = RVersion.parse(version);
		if(v === undefined) {
			return false;
		}
		const r = typeof range === 'string' ? RRange.parse(range) : range;
		return r !== undefined && semverSatisfies(v, r, { loose: true, includePrerelease: true });
	}
} as const;