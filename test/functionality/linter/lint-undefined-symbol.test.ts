import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('undefined symbol', () => {
		assertLinter('undefined function is flagged', parser, 'foo()',
			'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'foo', loc: [1, 1, 1, 5] }]);

		assertLinter('locally defined function is not flagged', parser, 'foo <- function() 1\nfoo()',
			'undefined-symbol', []);

		assertLinter('builtin is not flagged', parser, 'print("hi")\nc(1, 2)',
			'undefined-symbol', []);

		assertLinter('only the undefined call is flagged', parser, 'g <- function() 1\ng()\nh()',
			'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'h', loc: [3, 1, 3, 3] }]);

		// an unknown loaded library disables the rule: its exports might define the symbol
		assertLinter('not flagged when an unknown library is loaded', parser, 'library(somePkg)\nfoo()',
			'undefined-symbol', []);
	});
}));
