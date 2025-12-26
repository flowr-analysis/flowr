import { coerce, Range, SemVer } from 'semver';
import { guard } from './assert';


function makeVersion(version: string, original: string) {
	const semver = new SemVer(version) as SemVer & { str: string };
	semver.str = original;
	return semver;
}

const AdditionalVersionRegex = /(\d+\.\d+\.\d+)(?<additional>(\.\d+)+)(-(?<prerelease>[0-9A-Za-z-.]+))?/g;
/**
 * For every version `a.b.c.d.e...` converts it to `a.b.c-d.e...`
 * If the version already contains a prerelease part, this is prepended:
 * `a.b.c.d.e-prerelease...` becomes `a.b.c-d.e-prerelease...`
 */
function normalizeAdditionalVersionsToPrerelease(version: string): string {
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
	try {
		const normalized = normalizeAdditionalVersionsToPrerelease(range);
		return makeRange(normalized, range);
	} catch{ /* do nothing */ }
	return makeRange(range.replace(/==/g, '='), range);
}