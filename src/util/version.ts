import { SemVer } from 'semver';

// this is automatically replaced with the current version by release-it
const version = '2.2.15';

export function flowrVersion(): SemVer {
	return new SemVer(version);
}
