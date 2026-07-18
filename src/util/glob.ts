/**
 * Matching paths against gitignore-style patterns, as used for `.gitignore` rules and configured file globs.
 * @module
 */
import type ignore from 'ignore';
import { toPosixPath } from './files';

let ignoreFactory: typeof ignore | undefined;
/** The `ignore` factory, required on first use only. */
export function loadIgnore(): typeof ignore {
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on demand, see above
	return ignoreFactory ??= require('ignore') as typeof ignore;
}

/** `ignore` rejects absolute and windows paths */
function relative(filePath: string): string {
	return toPosixPath(filePath).replace(/^([a-zA-Z]:)?\/+/, '');
}

/**
 * Tests paths against `pattern`, ignoring capitalization: `?` and `*` stay within one path segment, `**` spans them.
 * A pattern anchored with a leading `/` has to match from the start, any other matches at any depth
 * (`global.R` matches `pkg/R/global.R`).
 */
export function globMatcher(pattern: string): (filePath: string) => boolean {
	const cleaned = relative(pattern);
	const ig = loadIgnore()({ ignorecase: true }).add(pattern.startsWith('/') ? cleaned : `**/${cleaned}`);
	return filePath => ig.ignores(relative(filePath));
}
