import { describe } from 'vitest';
import { withShell } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';

describe.sequential('flowR linter', withShell(shell => {
	describe('R1 deprecated functions', () => {
		assertLinter('none', shell, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)', 'deprecated-functions', []);
		assertLinter('cat', shell, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)', 'deprecated-functions', [
			{ certainty: LintingCertainty.Definitely, function: 'cat', range: [1, 1, 1, 12] },
			{ certainty: LintingCertainty.Definitely, function: 'cat', range: [4, 1, 4, 6] },
		], { deprecatedFunctions: ['cat'] });
		assertLinter('custom cat', shell, 'cat("hello")\nprint("hello")\ncat <- function(x) { }\nx <- 1\ncat(x)', 'deprecated-functions', [
			{ certainty: LintingCertainty.Definitely, function: 'cat', range: [1, 1, 1, 12] }
		], { deprecatedFunctions: ['cat'] });
	});
}));
