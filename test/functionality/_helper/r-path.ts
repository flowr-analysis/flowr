import { toPosixPath } from '../../../src/util/files';

/**
 * A filesystem path made safe to interpolate into an R string literal: backslashes become forward slashes
 * (which R accepts on every OS), so a Windows path like `C:\tmp\x.R` does not turn `\t`, `\x`, ... into R
 * escape sequences. A thin alias of {@link toPosixPath} for use wherever a path is embedded in R code.
 */
export const rPath = toPosixPath;
