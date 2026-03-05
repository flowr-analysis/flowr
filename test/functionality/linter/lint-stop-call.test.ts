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
	});
}));
