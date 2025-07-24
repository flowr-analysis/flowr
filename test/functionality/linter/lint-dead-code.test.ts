import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('dead code', () => {
		assertLinter('none', parser, 'x <- 1', 'dead-code', []);

		describe('simple', () => {
			assertLinter('always', parser, 'if(TRUE) 1 else 2', 'dead-code', [
				{ certainty: LintingCertainty.Definitely, range: [1, 17, 1, 17] }
			]);
			assertLinter('always multiline', parser, `
if(TRUE) {
	return(1)
} else {
	return(2)
}`, 'dead-code', [{ certainty: LintingCertainty.Definitely, range: [1, 17, 1, 17] }]);
			assertLinter('never', parser, 'if(FALSE) 1 else 2', 'dead-code', [
				{ certainty: LintingCertainty.Definitely, range: [1, 11, 1, 11] }
			]);
			assertLinter('no analysis', parser, 'if(FALSE) 1 else 2', 'dead-code', [], undefined, { analyzeDeadCode: false });
		});

		describe('non-constant', () => {
			assertLinter('always', parser, 'x <- TRUE; if(x) 1 else 2', 'dead-code', [
				{ certainty: LintingCertainty.Definitely, range: [1, 25, 1, 25] }
			]);
			assertLinter('never', parser, 'x <- FALSE; if(x) 1 else 2', 'dead-code', [
				{ certainty: LintingCertainty.Definitely, range: [1, 19, 1, 19] }
			]);
		});

		describe('if-elif-else', () => {
			assertLinter('TRUE FALSE', parser, 'if(TRUE) 1 else if (FALSE) 2 else 3', 'dead-code', [
				{ certainty: LintingCertainty.Definitely, range: [1, 17, 1, 35] }
			]);
			assertLinter('FALSE FALSE', parser, 'if(FALSE) 1 else if (FALSE) 2 else 3', 'dead-code', [
				{ certainty: LintingCertainty.Definitely, range: [1, 11, 1, 11] },
				{ certainty: LintingCertainty.Definitely, range: [1, 29, 1, 29] }
			]);
			assertLinter('FALSE TRUE', parser, 'if(FALSE) 1 else if (TRUE) 2 else 3', 'dead-code', [
				{ certainty: LintingCertainty.Definitely, range: [1, 11, 1, 11] },
				{ certainty: LintingCertainty.Definitely, range: [1, 35, 1, 35] }
			]);
		});
	});
}));
