import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('dead code', () => {
		assertLinter('simple always', parser, 'if(TRUE) 1 else 2', 'dead-code', [
			{ certainty: LintingCertainty.Definitely, range: [1, 17, 1, 17] }
		], { totalReachable: 9 });
		assertLinter('simple never', parser, 'if(FALSE) 1 else 2', 'dead-code', [
			{ certainty: LintingCertainty.Definitely, range: [1, 11, 1, 11] }
		], { totalReachable: 9 });

		assertLinter('non-constant always', parser, 'x <- TRUE; if(x) 1 else 2', 'dead-code', [
			{ certainty: LintingCertainty.Definitely, range: [1, 25, 1, 25] }
		], { totalReachable: 13 });
		assertLinter('non-constant never', parser, 'x <- FALSE; if(x) 1 else 2', 'dead-code', [
			{ certainty: LintingCertainty.Definitely, range: [1, 19, 1, 19] }
		], { totalReachable: 13 });
	});
}));
