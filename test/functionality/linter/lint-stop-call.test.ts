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
	});
}));
