import { coerce, Range, SemVer } from 'semver';
import { guard } from './assert';


function makeVersion(version: string, original: string) {
	const semver = new SemVer(version) as SemVer & { str: string };
	semver.str = original;
	return semver;
}

/**
 * Additionally, this transforms `a-b.c` into `a.0.0-b.c` and `a.b-c.d` into `a.b.0-c.d` to
 * ensure valid SemVer format.
 */
function normalizeTooShortVersions(versions: string): string {
	const TooShortVersionRegex = /(^|(?<=[^\d.-]))(?<major>\d+)(\.(?<minor>\d+))?\.?-(?<prerelease>[0-9A-Za-z-.]+)(\s|$)/g;
	let newVersions = '';
	let match: RegExpExecArray | null;
	while((match = TooShortVersionRegex.exec(versions)) !== null) {
		const { major, minor, prerelease } = match.groups as { major: string; minor?: string; prerelease: string };
		const prefix = versions.slice(0, match.index);
		let newVersion = '';
		if(minor === undefined) {
			// only major version present
			newVersion = `${major}.0.0-${prerelease}`;
		} else {
			// major and minor version present, but dot before prerelease
			newVersion = `${major}.${minor}.0-${prerelease}`;
		}
		newVersions += `${prefix}${newVersion}`;
		versions = versions.slice(match.index + match[0].length);
	}
	newVersions += versions; // append any remaining part
	return newVersions;
}

/**
 * For every version `a.b.c.d.e...` converts it to `a.b.c-d.e...`
 * If the version already contains a prerelease part, it is appended:
 * `a.b.c.d.e-prerelease...` becomes `a.b.c-d.e-prerelease...`
 */
function normalizeAdditionalVersionsToPrerelease(version: string): string {
	version = normalizeTooShortVersions(version);
	const AdditionalVersionRegex = /(\d+\.\d+\.\d+)(?<additional>(\.\d+)+)(-(?<prerelease>[0-9A-Za-z-.]+))?/g;

	let match: RegExpExecArray | null;
	let newVersion = '';
	// repeat until no more matches
	while((match = AdditionalVersionRegex.exec(version)) !== null) {
		// append to new version, first take over anything before the match
		const prefix = version.slice(0, match.index);
		const { additional, prerelease } = match.groups as { additional: string; prerelease?: string };
		const additionalParts = additional.slice(1).split('.'); // remove leading dot and split
		if(additionalParts.length === 0) {
			continue; // nothing to do
		}
		let newPrerelease = additionalParts.join('.');
		if(prerelease) {
			newPrerelease = `${newPrerelease}-${prerelease}`;
		}
		newVersion = `${prefix}${match[1]}-${newPrerelease}`;
		version = version.slice(match.index + match[0].length);
	}
	newVersion += version; // append any remaining part
	return newVersion;
}

/**
 * This parses an R version string and returns a SemVer object.
 * In contrast to just using `new SemVer(version)`, this function also tries to
 * normalize R's much free-er versioning scheme into valid SemVer versions.
 * You can always access the original version string via the `str` property on the returned object.
 */
export function parseRVersion(version: string): SemVer & { str: string } {
	try {
		return makeVersion(version, version);
	} catch{ /* do nothing */ }
	try {
		const normalized = normalizeAdditionalVersionsToPrerelease(version);
		return makeVersion(normalized, version);
	} catch{ /* do nothing */ }
	const coerced = coerce(version, { loose: true, includePrerelease: true });
	guard(coerced !== null, `Could not coerce R version "${version}" to SemVer`);
	return makeVersion(coerced.version, version);
}

function makeRange(range: string, original: string) {
	const semverRange = new Range(range) as Range & { str: string };
	semverRange.str = original;
	return semverRange;
}
/**
 * This parses an R version range string and returns a SemVer Range object.
 * In contrast to just using `new Range(range)`, this function also tries to
 * normalize R's much free-er versioning scheme into valid SemVer ranges.
 * You can always access the original range string via the `str` property on the returned object.
 */
export function parseRRange(range: string): Range & { str: string } {
	try {
		return makeRange(range, range);
	} catch{/* try to normalize R range to SemVer */}
	const normalized = normalizeAdditionalVersionsToPrerelease(range);
	return makeRange(normalized.replace(/==/g, '='), range);
}