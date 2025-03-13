import { describe } from 'vitest';
import { withShell } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { R1_DEPRECATED_FUNCTIONS } from '../../../src/linter/rules/1-deprecated-functions';
import { LintingCertainty } from '../../../src/linter/linter-format';

describe.sequential('flowR linter', withShell(shell => {
	describe('R1 deprecated functions', () => {
		assertLinter('none', shell, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)', R1_DEPRECATED_FUNCTIONS, []);
		assertLinter('cat', shell, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)', R1_DEPRECATED_FUNCTIONS, [
			{ certainty: LintingCertainty.Maybe, function: 'cat', range: [1, 1, 1, 12] },
			{ certainty: LintingCertainty.Maybe, function: 'cat', range: [4, 1, 4, 6] },
		], { deprecatedFunctions: ['cat'] });
	});
}));
