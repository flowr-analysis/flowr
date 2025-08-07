import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('deprecated functions', () => {
		/* Here, we expect no deprecated functions to be found, as neither `cat` nor `print` nor `<-` are listed as deprecated, we specifically clean the list of deprecated functions */
		assertLinter('no function listed', parser, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)',
			'deprecated-functions', [],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
			{ functionsToFind: [] }
		);
		/* Given that we declare `cat` as deprecated, we expect all uses to be marked! */
		assertLinter('cat', parser, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingCertainty.Definitely, function: 'cat', range: [1, 1, 1, 12] },
				{ certainty: LintingCertainty.Definitely, function: 'cat', range: [4, 1, 4, 6] },
			],
			{ totalCalls: 2, totalFunctionDefinitions: 2 },
			{ functionsToFind: ['cat'] }
		);
		/* Overwriting the `cat` function with a user defined implementation (even though it is useless), should cause the linter to not mark calls to the custom `cat` function as deprecated */
		assertLinter('custom cat', parser, 'cat("hello")\nprint("hello")\ncat <- function(x) { }\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingCertainty.Definitely, function: 'cat', range: [1, 1, 1, 12] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ functionsToFind: ['cat'] }
		);
		/* Using the default linter configuration, a function such as `all_equal` should be marked as deprecated */
		assertLinter('with defaults', parser, 'all_equal(foo)',
			'deprecated-functions', [
				{ certainty: LintingCertainty.Definitely, function: 'all_equal', range: [1, 1, 1, 14] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);
		/* We should find deprecated functions even if they are nested in other function calls */
		assertLinter('with defaults nested', parser, 'foo(all_equal(foo))',
			'deprecated-functions', [
				{ certainty: LintingCertainty.Definitely, function: 'all_equal', range: [1, 5, 1, 18] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);
		/* @ignore-in-wiki */
		assertLinter('wiki example', parser, `
first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)`, 'deprecated-functions',
		[{ certainty: LintingCertainty.Definitely, function: 'dplyr::all_equal', range: [4,1,4,31] }],
		{ totalCalls: 1, totalFunctionDefinitions: 1 });
	});
}));
