import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, controlledPkgDb } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { DeprecationState } from '../../../src/linter/rules/deprecated-functions';

describe('flowR linter', withTreeSitter(parser => {
	describe('deprecated functions', () => {
		/* Here, we expect no deprecated functions to be found, as neither `cat` nor `print` nor `<-` are listed as deprecated, we specifically clean the list of deprecated functions */
		assertLinter('no function listed', parser, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)',
			'deprecated-functions', [],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
			{ fns: [] }
		);
		/* Given that we declare `cat` as deprecated, we expect all uses to be marked! */
		assertLinter('cat', parser, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'cat', loc: [1, 1, 1, 12], type: 'deprecated-function' },
				{ certainty: LintingResultCertainty.Certain, function: 'cat', loc: [4, 1, 4, 6], type: 'deprecated-function' },
			],
			{ totalCalls: 2, totalFunctionDefinitions: 2 },
			{ fns: ['cat'] }
		);
		/* Overwriting the `cat` function with a user defined implementation (even though it is useless), should cause the linter to not mark calls to the custom `cat` function as deprecated */
		assertLinter('custom cat', parser, 'cat("hello")\nprint("hello")\ncat <- function(x) { }\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'cat', loc: [1, 1, 1, 12], type: 'deprecated-function' }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: ['cat'] }
		);
		/* Using the default linter configuration, a function such as `all_equal` should be marked as deprecated */
		assertLinter('with defaults', parser, 'all_equal(foo)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'all_equal', loc: [1, 1, 1, 14], type: 'deprecated-function' }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);
		/* We should find deprecated functions even if they are nested in other function calls */
		assertLinter('with defaults nested', parser, 'foo(all_equal(foo))',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'all_equal', loc: [1, 5, 1, 18], type: 'deprecated-function' }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);
		/* @ignore-in-wiki */
		assertLinter('wiki example', parser, `
first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)`, 'deprecated-functions',
		[{ certainty: LintingResultCertainty.Certain, function: 'dplyr::all_equal', loc: [4, 1, 4, 31], type: 'deprecated-function' }],
		{ totalCalls: 1, totalFunctionDefinitions: 1 });

		describe('a deprecated function resolved via a loaded package is still flagged', () => {
			// regression: the loaded-package export must still count as a built-in call target
			assertLinter('with a (controlled) package database', parser, 'library(dplyr)\nrecode(x)',
				'deprecated-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'recode', loc: [2, 1, 2, 9], type: 'deprecated-function' }],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: ['recode'], pkgDb: controlledPkgDb('dplyr', ['recode', 'filter']) }
			);
			assertLinter('without any package database', parser, 'library(dplyr)\nrecode(x)',
				'deprecated-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'recode', loc: [2, 1, 2, 9], type: 'deprecated-function' }],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: ['recode'], noPkgDb: true }
			);
		});

		describe('only detect deprecated args when present', () => {
			assertLinter('deprecated arg but not present', parser, 'testFn()',
				'deprecated-functions',
				[],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: [{ name: 'testFn', whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated }] } ] }
			);

			assertLinter('deprecated arg present', parser, 'testFn(badArg=5)',
				'deprecated-functions',
				[{
					type:       'deprecated-arg',
					certainty:  LintingResultCertainty.Certain,
					arg:        'badArg',
					replacedBy: 'foo',
					state:      DeprecationState.Deprecated,
					function:   'testFn',
					loc:        [1, 1, 1, 16]
				}],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: [{ name: 'testFn', whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo' }] } ] }
			);
		});
	});
}));
