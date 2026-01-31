/**
 * Represents R's `.standard_regexps` definitions.
 * @see https://github.com/r-devel/r-svn/blob/44474af03ae77fd3b9a340279fa10cb698d106c3/src/library/base/R/utils.R#L52-L53
 */
export const RStandardRegexp = {
	/** `[[:alpha:]][[:alnum:].]*[[:alnum:]]` */
	ValidPackageName:    (/[A-Za-z][A-Za-z0-9._]*[A-Za-z0-9]/),
	/** `([[:digit:]]+[.-]){1,}[[:digit:]]+` */
	ValidPackageVersion: (/([0-9]+[.-])+[0-9]+/),
	/** `[[:digit:]]+\\.[[:digit:]]+\\.[[:digit:]]+` */
	ValidRSystemVersion: (/[0-9]+\.[0-9]+\.[0-9]+/),
	/** `([[:digit:]]+[.-])*[[:digit:]]+` */
	ValidNumericVersion: /([0-9]+[.-])*[0-9]+/
};

/**
 * Based on the C-definition:
 * ```txt
 * !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~
 * ```
 */
export const RPunctuationChars = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';