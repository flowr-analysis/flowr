/**
 * The version of flowR on its own, without the version report around it, so the core utilities can name it cheaply.
 * @module
 */
import { SemVer } from 'semver';

// this is automatically replaced with the current version by release-it
const version = '2.17.7';
// this is automatically replaced with the release date by release-it (scripts/bump-version.ts)
export const versionDate = '2026-11-15T17:22:01Z';

/** Retrieves the current flowR version as a new {@link SemVer} object. */
export function flowrVersion(): SemVer {
	return new SemVer(version);
}
