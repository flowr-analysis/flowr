import fs from 'fs';

const VersionFile = 'src/util/version.ts';
const VersionLine = /const version = '[\d.]+'/;
const DateLine = /const versionDate = '[^']*'/;

/**
 * The source of `src/util/version.ts` with the released version and date written in. Throws when the
 * version is not plain `major.minor.patch` or either line is missing, so a release never silently skips it.
 */
export function bumpVersion(source: string, version: string, date: Date): string {
	if(!/^\d+\.\d+\.\d+$/.test(version)) {
		throw new Error(`expected a version like 1.2.3, got ${version}`);
	}
	if(!VersionLine.test(source) || !DateLine.test(source)) {
		throw new Error(`${VersionFile} lost its version or versionDate line`);
	}
	const stamp = date.toISOString().replace(/\.\d+Z$/, 'Z');
	return source
		.replace(VersionLine, `const version = '${version}'`)
		.replace(DateLine, `const versionDate = '${stamp}'`);
}

/* run by release-it after the bump (see `after:bump` in package.json), skipped when imported */
if(require.main === module) {
	fs.writeFileSync(VersionFile, bumpVersion(fs.readFileSync(VersionFile, 'utf-8'), process.argv[2] ?? '', new Date()));
}
