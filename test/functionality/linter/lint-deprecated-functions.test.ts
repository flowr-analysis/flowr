import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('deprecated functions', () => {
		assertLinter('no function listed', parser, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)',
			'deprecated-functions', [],
			{ totalDeprecatedCalls: 0, totalDeprecatedFunctionDefinitions: 0 },
			{ deprecatedFunctions: [] }
		);
		assertLinter('cat', parser, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingCertainty.Definitely, function: 'cat', range: [1, 1, 1, 12] },
				{ certainty: LintingCertainty.Definitely, function: 'cat', range: [4, 1, 4, 6] },
			],
			{ totalDeprecatedCalls: 2, totalDeprecatedFunctionDefinitions: 2 },
			{ deprecatedFunctions: ['cat'] }
		);
		assertLinter('custom cat', parser, 'cat("hello")\nprint("hello")\ncat <- function(x) { }\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingCertainty.Definitely, function: 'cat', range: [1, 1, 1, 12] }
			],
			{ totalDeprecatedCalls: 1, totalDeprecatedFunctionDefinitions: 1 },
			{ deprecatedFunctions: ['cat'] }
		);
		assertLinter('with defaults', parser, 'all_equal(foo)',
			'deprecated-functions', [
				{ certainty: LintingCertainty.Definitely, function: 'all_equal', range: [1, 1, 1, 14] }
			],
			{ totalDeprecatedCalls: 1, totalDeprecatedFunctionDefinitions: 1 }
		);
		assertLinter('with defaults nested', parser, 'foo(all_equal(foo))',
			'deprecated-functions', [
				{ certainty: LintingCertainty.Definitely, function: 'all_equal', range: [1, 5, 1, 18] }
			],
			{ totalDeprecatedCalls: 1, totalDeprecatedFunctionDefinitions: 1 }
		);
		assertLinter('wiki example', parser, `
first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)`, 'deprecated-functions',
		[{ certainty: LintingCertainty.Definitely, function: 'dplyr::all_equal', range: [4,1,4,31] }],
		{ totalDeprecatedCalls: 1, totalDeprecatedFunctionDefinitions: 1 });
	});
}));
