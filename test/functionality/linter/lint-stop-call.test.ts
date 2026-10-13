import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { SourceRange } from '../../../src/util/range';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('stop with call', () => {
		assertLinter('none', parser, 'x <- 1', 'stop-call', []);
		assertLinter('a top-level stop has no call to append', parser, 'stop(x)', 'stop-call', []);
		assertLinter('single stop', parser, 'f <- function(x) stop(x)', 'stop-call', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       SourceRange.from(1, 18, 1, 24)
			}
		]);
		assertLinter('single stop with arg', parser, 'f <- function(x) stop(x, call.=FALSE)', 'stop-call', []);
		assertLinter('shadow call.', parser, 'stop <- function(x, call.){return 0}\nf <- function() stop(3, call.=TRUE)', 'stop-call', []);
		assertLinter('stop with set to true', parser, 'f <- function(y) stop(y, call.=TRUE)', 'stop-call', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       SourceRange.from(1, 18, 1, 36)
			}
		]);
		assertLinter('resolve flag in stop', parser, 'f <- function(y) { x <- FALSE; stop(y, call.=x) }', 'stop-call', []);
		assertLinter('a condition object carries its own call', parser, 'f <- function() stop(simpleError("x"))', 'stop-call', []);
		assertLinter('a condition object built with structure', parser, 'f <- function() stop(structure(class = c("myError", "error", "condition"), list(message = "m", call = NULL)))', 'stop-call', []);
		assertLinter('stop handed to do.call states its arguments there', parser, 'f <- function() { args <- list("m", call. = FALSE); do.call(stop, args) }', 'stop-call', []);
		assertLinter('a direct stop beside one handed to do.call is still reported', parser, 'f <- function() { args <- list("m", call. = FALSE); do.call(stop, args); stop("y") }', 'stop-call', [
			{ certainty: LintingResultCertainty.Uncertain, loc: SourceRange.from(1, 74, 1, 82) }
		]);
		assertLinter('an object built with structure but no condition class is reported', parser, 'f <- function() stop(structure(class = "myError", list(message = "m", call = NULL)))', 'stop-call', [
			{ certainty: LintingResultCertainty.Uncertain, loc: SourceRange.from(1, 17, 1, 84) }
		]);
		assertLinter('a qualified base::stop', parser, 'f <- function() base::stop("x")', 'stop-call', [
			{ certainty: LintingResultCertainty.Uncertain, loc: SourceRange.from(1, 17, 1, 31) }
		]);
	});
}));
