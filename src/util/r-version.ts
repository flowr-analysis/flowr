import { coerce, Range, SemVer } from 'semver';
import { guard } from './assert';


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
	const [mainVersion, ...preReleaseParts] = version.split('-');
	const mainVersionParts = mainVersion.split('.');
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

/** Helpers for R package versions (`1.2-3` style), which are freer than SemVer. */
export const RVersion = {
	/**
	 * Parse an R version string into a {@link SemVer}, normalizing R's freer scheme (e.g. `0.4-9`). Unlike
	 * `new SemVer(version)` this coerces where needed; the original string is available via `.str`.
	 */
	parse(this: void, version: string): SemVer & { str: string } {
		try {
			return makeVersion(version, version);
		} catch{ /* try to normalize */ }
		try {
			return makeVersion(normalizeVersions(version), version);
		} catch{ /* fall back to coercion */ }
		const coerced = coerce(version, { loose: true, includePrerelease: true });
		guard(coerced !== null, `Could not coerce R version "${version}" to SemVer`);
		return makeVersion(coerced.version, version);
	},

	/**
	 * Compare two R version strings following R's `numeric_version` scheme: split on `.` and `-`, compare
	 * numerically, shorter versions padded with zeros (`0.4-9 < 0.4.10 < 1.0`). Negative/zero/positive for
	 * `a` less than/equal to/greater than `b`.
	 */
	compare(this: void, a: string, b: string): number {
		const pa = a.split(/[.-]/), pb = b.split(/[.-]/);
		for(let i = 0; i < Math.max(pa.length, pb.length); i++) {
			const x = Number(pa[i] ?? 0) || 0, y = Number(pb[i] ?? 0) || 0;
			if(x !== y) {
				return x - y;
			}
		}
		return 0;
	}
} as const;

/** Helpers for R package version ranges (DESCRIPTION constraints like `>= 0.4-9`). */
export const RRange = {
	/**
	 * Parse an R version range string into a {@link Range}, normalizing R's freer scheme. The original range
	 * string is available via `.str`.
	 */
	parse(this: void, range: string): Range & { str: string } {
		try {
			return makeRange(range, range);
		} catch{ /* try to normalize R range to SemVer */ }
		return makeRange(normalizeVersions(range), range);
	}
} as const;