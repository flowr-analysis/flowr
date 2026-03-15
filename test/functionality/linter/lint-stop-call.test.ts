import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { SourceRange } from '../../../src/util/range';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('stop with call', () => {
		assertLinter('none', parser, 'x <- 1', 'stop-call', []);
		assertLinter('none', parser, 'stop(x)', 'stop-call', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       SourceRange.from(1, 1, 1, 7)
			}
		]);
		assertLinter('none', parser, 'stop(x, call.=FALSE)', 'stop-call', []);
		assertLinter('none', parser, 'stop <- function(x, call.){return 0}\nstop(3, call.=TRUE)', 'stop-call', []);
		assertLinter('none', parser, 'stop(y, call.=TRUE)', 'stop-call', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       SourceRange.from(1, 1, 1, 19)
			}
		]);
		assertLinter('none', parser, 'x <- FALSE\nstop(y, call.=x)', 'stop-call', []);
	});
}));
