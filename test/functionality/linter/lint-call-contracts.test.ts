import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { SourceRange } from '../../../src/util/range';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('call contracts', () => {
		const f = 'f <- function(m) { if(m < 0) stop("m < 0"); stopifnot(is.numeric(m)); m }\n';
		assertLinter('a call within the contract', parser, f + 'f(2)', 'call-contracts', []);
		assertLinter('a value below the bound', parser, f + 'f(-1)', 'call-contracts', [
			{ certainty: LintingResultCertainty.Uncertain, loc: SourceRange.from(2, 1, 2, 5), function: 'f', broken: ['m is -1, outside of [0, Inf]'] }
		]);
		assertLinter('a value of the wrong type, resolved from a variable', parser, f + 'v <- "a"\nf(v)', 'call-contracts', [
			{ certainty: LintingResultCertainty.Uncertain, loc: SourceRange.from(3, 1, 3, 4), function: 'f', broken: ['typeof(m) is character, not one of integer, double'] }
		]);
		assertLinter('a required argument left out', parser, f + 'f()', 'call-contracts', [
			{ certainty: LintingResultCertainty.Uncertain, loc: SourceRange.from(2, 1, 2, 3), function: 'f', broken: ['m is not given'] }
		]);
		assertLinter('a choice of match.arg that names none', parser, 'g <- function(how = c("a", "bb")) { how <- match.arg(how); how }\ng("c")', 'call-contracts', [
			{ certainty: LintingResultCertainty.Uncertain, loc: SourceRange.from(2, 1, 2, 6), function: 'g', broken: ['how is "c", not a unique prefix of "a", "bb"'] }
		]);
		assertLinter('a function of R written in C', parser, 'strsplit(1, "a")', 'call-contracts', [
			{ certainty: LintingResultCertainty.Uncertain, loc: SourceRange.from(1, 1, 1, 16), function: 'strsplit', broken: ['typeof(x) is integer or double, not one of character'] }
		]);
		assertLinter('an unknown value is not judged', parser, f + 'f(runif(1))', 'call-contracts', []);
	});
}));
