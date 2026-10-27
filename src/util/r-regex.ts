import { log } from './log';

/**
 * Represents R's `.standard_regexps` definitions.
 * @see https://github.com/r-devel/r-svn/blob/44474af03ae77fd3b9a340279fa10cb698d106c3/src/library/base/R/utils.R#L52-L53
 */
export const RStandardRegexp = {
	/** `[[:alpha:]][[:alnum:].]*[[:alnum:]]` */
	ValidPackageName:    (/[A-Za-z][A-Za-z0-9._]*[A-Za-z0-9]/),
	/** `([[:digit:]]+[.-]){1,}[[:digit:]]+` */
	ValidPackageVersion: (/(\d+[.-])+\d+/),
	/** `[[:digit:]]+\\.[[:digit:]]+\\.[[:digit:]]+` */
	ValidRSystemVersion: (/\d+\.\d+\.\d+/),
	/** `([[:digit:]]+[.-])*[[:digit:]]+` */
	ValidNumericVersion: /(\d+[.-])*\d+/
};

/**
 * Based on the C-definition:
 * ```txt
 * !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~
 * ```
 */
export const RPunctuationChars = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

const PosixClassMap = {
	digit:  '0-9',
	lower:  'a-z',
	upper:  'A-Z',
	alpha:  'A-Za-z',
	alnum:  'A-Za-z0-9',
	space:  String.raw`\s`,
	blank:  String.raw` \t`,
	punct:  "!\"#$%&'()*+,\\-./:;<=>?@[\\\\\\]^_`{|}~",
	xdigit: 'A-Fa-f0-9',
	ascii:  '\x00-\x7F',
	cntrl:  '\x00-\x1F\x7F',
	graph:  '\x21-\x7E',
	word:   'A-Za-z0-9_',
	print:  '\x20-\x7E'
} as const;
const posixClassRegex = /\[:([a-z]+):]/g;

/** a posix class {@link PosixClassMap} does not know, which JavaScript would read as a plain bracket expression */
const unknownPosixClass = new RegExp(String.raw`\[:(?!(?:${Object.keys(PosixClassMap).join('|')}):\])`);
/** an escape of a letter or digit, which R and JavaScript read differently (`\<`, `\d`, a back reference) */
const divergentEscape = /\\[^.^$*+?()[\]{}|\\/-]/;

/** the flags R accepts inside the pattern (`(?i)foo`), which JavaScript only takes next to it */
const inlineFlags = /^\(\?([imsx]+)\)/;
/** what a pattern JavaScript cannot compile falls back to, so one bad pattern matches nothing rather than throwing */
const matchesNothing = /(?!)/;

/**
 * Converts an R regex pattern (which may include POSIX character classes) into a JavaScript RegExp.
 */
export function parseRRegexPattern(pattern: string): RegExp {
	let convertedPattern = pattern.replaceAll(posixClassRegex, (s, className) => {
		const charClass = PosixClassMap[className as keyof typeof PosixClassMap];
		return charClass ?? s;
	});
	// we also want to support a glob '*' without any prefix:
	if(convertedPattern.startsWith('*') || convertedPattern.startsWith('+')) {
		convertedPattern = '.' + convertedPattern;
	}
	let flags = '';
	const inline = inlineFlags.exec(convertedPattern);
	if(inline) {
		/* `x` (extended) has no counterpart, the others carry over by name */
		flags = inline[1].replaceAll('x', '');
		convertedPattern = convertedPattern.slice(inline[0].length);
	}
	try {
		return new RegExp(convertedPattern, flags);
	} catch(e) {
		log.warn(`R pattern ${JSON.stringify(pattern)} is no JavaScript regex, treating it as matching nothing: ${(e as Error).message}`);
		return matchesNothing;
	}
}

/**
 * As {@link parseRRegexPattern}, but only where the JavaScript regex matches what R matches: `undefined` for a pattern
 * with an escape or a group (`(?...)`) the two read differently, a posix class there is no translation for, or one
 * JavaScript cannot compile.
 */
export function parseRRegexPatternExactly(pattern: string): RegExp | undefined {
	if(divergentEscape.test(pattern) || pattern.includes('(?') || unknownPosixClass.test(pattern)) {
		return undefined;
	}
	const regex = parseRRegexPattern(pattern);
	return regex === matchesNothing ? undefined : regex;
}
