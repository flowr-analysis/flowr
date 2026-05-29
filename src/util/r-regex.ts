
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
	return new RegExp(convertedPattern);
}
