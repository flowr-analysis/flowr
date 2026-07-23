/**
 * Matching paths against gitignore-style patterns, as used for `.gitignore` rules and configured file globs.
 * @module
 */
import type ignore from 'ignore';
import { toPosixPath } from './files';
import { log } from './log';

const rbuildignoreLog = log.getSubLogger({ name: 'rbuildignore' });

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

/**
 * Unlike `.gitignore`, the lines of an `.Rbuildignore` are (Perl-compatible) *regular expressions* rather than
 * globs, matched unanchored and case-insensitively against the path relative to the package root, as `R CMD build` does.
 * Invalid lines are dropped with a warning.
 */
export function rbuildignoreMatcher(content: string): (relativePath: string) => boolean {
	const patterns: RegExp[] = [];
	for(const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if(trimmed.length === 0) {
			continue;
		}
		try {
			patterns.push(new RegExp(trimmed, 'i'));
		} catch{
			rbuildignoreLog.warn(`Ignoring invalid .Rbuildignore pattern '${trimmed}'.`);
		}
	}
	if(patterns.length === 0) {
		return () => false;
	}
	return relativePath => {
		const posix = relative(relativePath);
		if(posix === '') {
			return false;
		}
		const segments = posix.split('/');
		// R walks the tree, so a match on any ancestor prefix drops the whole subtree
		for(let i = 1; i <= segments.length; i++) {
			const prefix = segments.slice(0, i).join('/');
			if(patterns.some(p => p.test(prefix))) {
				return true;
			}
		}
		return false;
	};
}
