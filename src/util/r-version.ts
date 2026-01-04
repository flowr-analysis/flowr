import { coerce, Range, SemVer } from 'semver';
import { guard } from './assert';


function makeVersion(version: string, original: string) {
	const semver = new SemVer(version) as SemVer & { str: string };
	semver.str = original;
	return semver;
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
	return comparator + mainVersionParts.map(n => String(Number(n))).join('.') + (preReleaseParts.length > 0 ? `-${preReleaseParts.join('-')}` : '');
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
		const normalized = normalizeVersions(version);
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
	const normalized = normalizeVersions(range);
	return makeRange(normalized, range);
}